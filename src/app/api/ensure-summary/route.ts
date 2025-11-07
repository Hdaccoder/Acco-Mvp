// src/app/api/ensure-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from "firebase-admin/firestore";

type Vote = {
  intent: "yes" | "maybe" | "no";
  selections?: { venueId: string; arrivalWindow?: string }[];
  lastEditedAt?: Timestamp;
};

function nightKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function addDays(d: Date, delta: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}
function weekdayIndex(d: Date) {
  // 0=Sun ... 6=Sat
  return d.getDay();
}

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  try {
    // --------- security -----------
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!CRON_SECRET || key !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional query:
    //   for=YYYYMMDD  (generate prediction for a specific night)
    //   backfill=N    (generate last N nights)
    //   dryRun=1      (don’t write)
    const forParam = url.searchParams.get("for");
    const backfill = Number(url.searchParams.get("backfill") || 0);
    const dryRun = url.searchParams.get("dryRun") === "1";

    if (backfill > 0) {
      const today = new Date();
      const outputs: string[] = [];
      for (let i = backfill; i >= 1; i--) {
        const date = addDays(today, -i);
        const nk = nightKey(date);
        const res = await generatePrediction(nk);
        outputs.push(`${nk}:${res.top?.[0] ?? "none"}`);
        if (!dryRun) await writePrediction(nk, res);
      }
      return NextResponse.json({ ok: true, backfilled: outputs, dryRun });
    }

    const targetKey = forParam || nightKey(addDays(new Date(), 0)); // default = today/tonight
    const out = await generatePrediction(targetKey);

    if (!dryRun) await writePrediction(targetKey, out);

    return NextResponse.json({ ok: true, targetKey, dryRun, out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}

/** Reads past nights and generates a per-venue prediction (0–100) + typical peak. */
async function generatePrediction(targetNightKey: string) {
  const db = adminDb();
  //const app = getAdminApp(); // keep admin app warm

  // ---- parameters you can tweak ----
  const USE_WEEKS = 8;                // how many weeks back (same weekday)
  const RECENT_DAYS = 14;             // trend lookback window
  const ALPHA_SAME_WEEKDAY = 0.6;     // blend weight for same-weekday baseline
  const ALPHA_RECENT_TREND = 0.4;     // blend weight for recent days trend

  // derive target date
  const y = Number(targetNightKey.slice(0, 4));
  const m = Number(targetNightKey.slice(4, 6)) - 1;
  const d = Number(targetNightKey.slice(6, 8));
  const targetDate = new Date(y, m, d);
  const targetWday = weekdayIndex(targetDate);

  // ------------ gather past nights ------------
  // 1) Same weekday across the last N weeks
  const sameWeekdayKeys: string[] = [];
  for (let w = 1; w <= USE_WEEKS; w++) {
    const date = addDays(targetDate, -7 * w);
    sameWeekdayKeys.push(nightKey(date));
  }

  // 2) Recent trend (last RECENT_DAYS)
  const recentKeys: string[] = [];
  for (let i = 1; i <= RECENT_DAYS; i++) {
    const date = addDays(targetDate, -i);
    recentKeys.push(nightKey(date));
  }

  // helper to tally (voters and arrival windows)
  const venueCountSame: Record<string, number> = {};
  const venueCountRecent: Record<string, number> = {};
  const arrivalCount: Record<string, Record<string, number>> = {};

  // Count function used for both sets
  async function tallyNight(nk: string, bucket: Record<string, number>) {
    const snap = await db.collection("nights").doc(nk).collection("votes").get();
    snap.forEach((d) => {
      const v = d.data() as Vote;
      if (!v || v.intent === "no" || !Array.isArray(v.selections)) return;

      for (const s of v.selections) {
        const vid = s.venueId;
        if (!vid) continue;

        bucket[vid] = (bucket[vid] ?? 0) + 1;

        if (s.arrivalWindow) {
          arrivalCount[vid] ??= {};
          arrivalCount[vid][s.arrivalWindow] =
            (arrivalCount[vid][s.arrivalWindow] ?? 0) + 1;
        }
      }
    });
  }

  // Run tallies
  await Promise.all(sameWeekdayKeys.map((nk) => tallyNight(nk, venueCountSame)));
  await Promise.all(recentKeys.map((nk) => tallyNight(nk, venueCountRecent)));

  // Normalise vectors to 0..1 so blends are comparable
  function normalise(map: Record<string, number>) {
    const max = Math.max(1, ...Object.values(map));
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) out[k] = v / max;
    return out;
  }
  const normSame = normalise(venueCountSame);
  const normRecent = normalise(venueCountRecent);

  // Blend to form a raw score, then scale to 0..100
  const blended: Record<string, number> = {};
  const allVenueIds = new Set([
    ...Object.keys(normSame),
    ...Object.keys(normRecent),
  ]);
  for (const id of allVenueIds) {
    const s = normSame[id] ?? 0;
    const r = normRecent[id] ?? 0;
    blended[id] = ALPHA_SAME_WEEKDAY * s + ALPHA_RECENT_TREND * r;
  }
  const maxBlend = Math.max(0.001, ...Object.values(blended));
  const score0to100: Record<string, number> = {};
  for (const [id, v] of Object.entries(blended)) {
    score0to100[id] = Math.round((v / maxBlend) * 100);
  }

  // Typical peak from arrivalCount map
  const typicalPeak: Record<string, string | null> = {};
  for (const [vid, counts] of Object.entries(arrivalCount)) {
    let best: { k: string; n: number } | null = null;
    for (const [k, n] of Object.entries(counts)) {
      if (!best || n > best.n) best = { k, n };
    }
    typicalPeak[vid] = best?.k ?? null;
  }

  // Rank
  const top = Object.entries(score0to100)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 10);

  return {
    generatedAt: Timestamp.now(),
    targetNightKey,
    items: Object.fromEntries(
      Object.entries(score0to100).map(([id, score]) => [
        id,
        { score, typicalPeak: typicalPeak[id] ?? null },
      ])
    ),
    top,
  };
}

async function writePrediction(nk: string, payload: any) {
  const db = adminDb();
  await db.collection("prediction_summaries").doc(nk).set(payload, { merge: true });
}
