import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit, requireUser } from "@/lib/api-security";
import { VENUES } from "@/lib/venues";
import { FOOD_VENUES } from "@/lib/food_venues";
import { nightKey as currentNightKey } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const selectionSchema = z.object({
  venueId: z.string().min(1).max(120),
  arrivalWindow: z.enum(["18-19", "19-20", "20-21", "21-22", "22-23", "23-24", "00-01", "01-02"]).optional(),
  price: z.number().min(0).max(1000).optional(),
}).strict();
const payloadSchema = z.object({
  mode: z.enum(["nightlife", "food"]),
  nightKey: z.string().regex(/^\d{8}$/),
  vote: z.object({
    intent: z.enum(["yes", "maybe", "no"]),
    selections: z.array(selectionSchema).max(8),
    location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).nullable().optional() }).strict().nullable().optional(),
    city: z.string().max(100).nullable().optional(),
  }).strict(),
}).strict();

export async function POST(req: Request) {
  const limited = rateLimit(`vote:${clientIp(req)}`, 20, 60_000);
  if (limited) return limited;
  const decoded = await requireUser(req);
  if (!decoded?.uid) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });

  try {
    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid vote payload." }, { status: 400 });
    const { mode, nightKey, vote } = parsed.data;
    if (nightKey !== currentNightKey()) return NextResponse.json({ ok: false, error: "Votes can only be submitted for tonight." }, { status: 400 });

    // A stay-in vote should not contribute a venue, price, arrival time, or
    // location. Ignore selections from older clients that still send one.
    const selections = vote.intent === "no" ? [] : vote.selections;
    if (mode === "food" && (vote.intent !== "yes" || selections.length !== 1)) {
      return NextResponse.json({ ok: false, error: "Food votes must select one place." }, { status: 400 });
    }
    if (mode === "nightlife" && vote.intent !== "no" && selections.length === 0) {
      return NextResponse.json({ ok: false, error: "Choose at least one place." }, { status: 400 });
    }
    const selectedIds = selections.map((selection) => selection.venueId);
    if (new Set(selectedIds).size !== selectedIds.length) {
      return NextResponse.json({ ok: false, error: "Choose each place only once." }, { status: 400 });
    }
    const allowedIds = new Set((mode === "food" ? FOOD_VENUES : VENUES).map((venue) => venue.id));
    if (selections.some((selection) => !allowedIds.has(selection.venueId))) {
      return NextResponse.json({ ok: false, error: "Unknown venue." }, { status: 400 });
    }
    const collectionName = mode === "food" ? "food_nights" : "nights";
    await adminDb().doc(`${collectionName}/${nightKey}/votes/${decoded.uid}`).set({
      intent: vote.intent,
      selections: selections.map((selection) => ({ ...selection, updatedAt: Timestamp.now() })),
      location: vote.intent === "no" ? null : vote.location ? {
        lat: Math.round(vote.location.lat * 100) / 100,
        lng: Math.round(vote.location.lng * 100) / 100,
        accuracy: vote.location.accuracy ?? null,
      } : null,
      city: vote.city ?? null,
      userId: decoded.uid,
      nightKey,
      createdAt: Timestamp.now(),
      lastEditedAt: Timestamp.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/vote/submit]", error);
    return NextResponse.json({ ok: false, error: "Unable to save vote." }, { status: 500 });
  }
}
