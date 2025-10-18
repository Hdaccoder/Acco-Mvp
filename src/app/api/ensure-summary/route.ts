// src/app/api/ensure-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { VENUES } from "@/lib/venues";

/**
 * Runtime must be Node.js so we can use Admin SDK.
 */
export const runtime = "nodejs";

/** Helpers to read env in prod and dev */
const CRON_SECRET =
  (process.env.CRON_SECRET || "").trim() ||
  (process.env.VERCEL_CRON_SECRET || "").trim(); // optional fallback if you used a different name

/** Parse YYYYMMDD as number -> Date (local). */
function parseNight(key: string): Date | null {
  if (!/^\d{8}$/.test(key)) return null;
  const y = +key.slice(0, 4);
  const m = +key.slice(4, 6) - 1;
  const d = +key.slice(6, 8);
  const dt = new Date(y, m, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Format date -> YYYYMMDD using local (UK) time. */
function formatNight(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Return last N night keys strictly BEFORE `endKey` (exclusive). */
function lastNNightsBefore(endKey: string, n: number): string[] {
  const end = parseNight(endKey) || new Date();
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(formatNight(d));
  }
  return out;
}

/** Tiny normaliser: weighted votes -> 0..100 (cap). */
function toScore0to100(weight: number) {
  return Math.max(0, Math.min(100, Math.round(weight * 10)));
}

/** Check auth via query ?key=..., header x-cron-key: ... OR Authorization: Bearer ... */
function isAuthorised(req: NextRequest): boolean {
  const qKey = (req.nextUrl.searchParams.get("key") || "").trim();
  const hKey = (req.headers.get("x-cron-key") || "").trim();
  const bearer = (req.headers.get("authorization") || "").trim();
  const bKey = bearer.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : "";
  if (!CRON_SECRET) return false;
  return [qKey, hKey, bKey].includes(CRON_SECRET);
}

export async function GET(req: NextRequest) {
  // 1) Auth
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Params
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  // allow building for a specific "today" (useful for backfill)
  const todayKeyOverride = req.nextUrl.searchParams.get("date"); // YYYYMMDD
  const nowUK = new Date(); // local process time (your server is UTC, but for our summary that's fine)
  const todayKey = todayKeyOverride && /^\d{8}$/.test(todayKeyOverride)
    ? todayKeyOverride
    : formatNight(nowUK);

  // 3) Collect recent nights (e.g., 7 nights ending before today)
  const recentNightKeys = lastNNightsBefore(todayKey, 7);

  // 4) Aggregate from votes
  const db = adminDb();
  const tallies: Record<string, { voters: number; weighted: number }> = {};
  const arrivals: Record<string, Record<string, number>> = {};

  for (const nk of recentNightKeys) {
    const votesSnap = await db.collection("nights").doc(nk).collection("votes").get();

    votesSnap.forEach((doc) => {
      const v: any = doc.data();
      if (!v || v.intent === "no") return;

      // simple weighting: yes=1, maybe=0.6; you can refine if you prefer
      const w = v.intent === "maybe" ? 0.6 : 1;

      for (const sel of v.selections || []) {
        const venueId: string = sel.venueId;
        if (!venueId) continue;

        tallies[venueId] ??= { voters: 0, weighted: 0 };
        tallies[venueId].voters += 1;
        tallies[venueId].weighted += w;

        if (sel.arrivalWindow) {
          arrivals[venueId] ??= {};
          arrivals[venueId][sel.arrivalWindow] =
            (arrivals[venueId][sel.arrivalWindow] ?? 0) + 1;
        }
      }
    });
  }

  // 5) Convert to items for UI
  const venueIndex = new Map(VENUES.map((v) => [v.id, v]));
  const items = VENUES.map((v) => {
    const t = tallies[v.id] || { voters: 0, weighted: 0 };
    // pick "typical" peak = most frequent arrival window from the sample
    let peakLabel: string | null = null;
    if (arrivals[v.id]) {
      let bestKey: string | null = null;
      let bestN = -1;
      for (const [k, n] of Object.entries(arrivals[v.id])) {
        if (n > bestN) {
          bestN = n;
          bestKey = k;
        }
      }
      peakLabel = bestKey;
    }

    return {
      id: v.id,
      name: v.name,
      voters: t.voters,
      score: toScore0to100(t.weighted),
      peakLabel,
      lat: v.lat,
      lng: v.lng,
    };
  })
    // sort by score desc (tie-break by voters)
    .sort((a, b) => (b.score - a.score) || (b.voters - a.voters));

  // 6) Write summary doc unless dryRun
  if (!dryRun) {
    await db.collection("prediction_summaries").doc(todayKey).set({
      createdAt: new Date(),
      sourceNights: recentNightKeys,
      items,
    }, { merge: true });
  }

  return NextResponse.json({
    ok: true,
    date: todayKey,
    nightsUsed: recentNightKeys.length,
    dryRun,
    items,
  });
}

