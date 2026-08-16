import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { nightKey } from "@/lib/dates";
import { clientIp, rateLimit, requireUser } from "@/lib/api-security";
import { VENUES } from "@/lib/venues";
import { FOOD_VENUES } from "@/lib/food_venues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const REPORT_REASONS = ["spiking", "fight", "bouncers", "other"] as const;
const reportSchema = z.object({ venueId: z.string().min(1).max(120), reason: z.enum(REPORT_REASONS) }).strict();
const venueIds = new Set([...VENUES, ...FOOD_VENUES].map((venue) => venue.id));

export async function POST(req: Request) {
  const limited = rateLimit(`report:${clientIp(req)}`, 5, 60 * 60_000);
  if (limited) return limited;
  const user = await requireUser(req);
  if (!user?.uid) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success || !venueIds.has(parsed.data.venueId)) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
    const currentNight = nightKey();
    const reportId = `${currentNight}_${parsed.data.venueId}_${encodeURIComponent(user.uid)}`;
    await adminDb().collection("venueReports").doc(reportId).set({
      ...parsed.data,
      reporterUid: user.uid,
      nightKey: currentNight,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/venue/report]", error);
    return NextResponse.json({ error: "Unable to submit report." }, { status: 500 });
  }
}
