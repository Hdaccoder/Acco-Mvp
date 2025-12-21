// src/app/api/ensure-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from "firebase-admin/firestore";
import { generatePredictionForNight, writePrediction, nightKey } from '@/lib/predictions';

type Vote = {
  intent: "yes" | "maybe" | "no";
  selections?: { venueId: string; arrivalWindow?: string }[];
  lastEditedAt?: Timestamp;
};

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
        const res = await generatePredictionForNight(nk);
        outputs.push(`${nk}:${res.top?.[0] ?? "none"}`);
        if (!dryRun) await writePrediction(nk, res);
      }
      return NextResponse.json({ ok: true, backfilled: outputs, dryRun });
    }

    const targetKey = forParam || nightKey(addDays(new Date(), 0)); // default = today/tonight
    const out = await generatePredictionForNight(targetKey);

    if (!dryRun) await writePrediction(targetKey, out);

    return NextResponse.json({ ok: true, targetKey, dryRun, out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}

/** Reads past nights and generates a per-venue prediction (0–100) + typical peak. */
// generation logic moved to src/lib/predictions.ts
