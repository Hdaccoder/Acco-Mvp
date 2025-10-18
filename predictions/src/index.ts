/**
 * Cloud Functions: nightly predictions + manual backfill.
 * Folder: /predictions
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/** Format today as YYYYMMDD in Europe/London */
function todayKey(): string {
  const now = new Date();
  // Get date in Europe/London without external libs (OK for our daily use case)
  const uk = new Date(
    now.toLocaleString("en-GB", { timeZone: "Europe/London" })
  );
  const y = uk.getFullYear();
  const m = String(uk.getMonth() + 1).padStart(2, "0");
  const d = String(uk.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Previous N date keys, newest -> oldest */
function recentDateKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date(
    new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })
  );
  for (let i = 0; i < n; i++) {
    const dt = new Date(now);
    dt.setDate(now.getDate() - i);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    out.push(`${y}${m}${d}`);
  }
  return out;
}

/**
 * Build a simple prediction summary:
 * - Look back over the last 7 nights of votes.
 * - Score each venue by total (yes+maybe) selections.
 * - Typical peak = most common arrivalWindow seen in those nights (fallback "21-22").
 */
async function buildPredictionSummary(): Promise<{
  venues: Record<string, { score: number; peakLabel: string }>;
}> {
  const lookback = 7;
  const dateKeys = recentDateKeys(lookback);

  const counts: Record<string, number> = {}; // venueId -> count
  const peakBuckets: Record<string, Record<string, number>> = {}; // venueId -> (window -> count)

  for (const k of dateKeys) {
    const votesRef = db.collection("nights").doc(k).collection("votes");
    const snap = await votesRef.get();
    snap.forEach((doc) => {
      const v = doc.data() as any;
      if (!v || v.intent === "no") return;

      const selections: Array<{ venueId: string; arrivalWindow?: string }> =
        Array.isArray(v?.selections) ? v.selections : [];
      selections.forEach((sel) => {
        if (!sel?.venueId) return;
        counts[sel.venueId] = (counts[sel.venueId] ?? 0) + 1;

        const win = sel.arrivalWindow ?? "21-22";
        if (!peakBuckets[sel.venueId]) peakBuckets[sel.venueId] = {};
        peakBuckets[sel.venueId][win] = (peakBuckets[sel.venueId][win] ?? 0) + 1;
      });
    });
  }

  // Normalize venue scores to 0-100
  const maxCount = Math.max(1, ...Object.values(counts));
  const venues: Record<string, { score: number; peakLabel: string }> = {};

  Object.keys(counts).forEach((venueId) => {
    const raw = counts[venueId];
    const score = Math.round((raw / maxCount) * 100);

    const bucket = peakBuckets[venueId] || {};
    const peakLabel =
      Object.keys(bucket).sort((a, b) => bucket[b] - bucket[a])[0] ?? "21-22";

    venues[venueId] = { score, peakLabel };
  });

  return { venues };
}

/** Write final summary doc for given date key into 'prediction_summaries' */
async function writeSummaryDoc(dateKey: string, data: { venues: Record<string, { score: number; peakLabel: string }> }) {
  await db
    .collection("prediction_summaries")
    .doc(dateKey)
    .set(
      {
        venues: data.venues,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/** Nightly schedule: run daily ~19:00 UK (adjust if you prefer) */
export const nightlyPredictions = onSchedule(
  {
    schedule: "0 19 * * *",
    timeZone: "Europe/London",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const key = todayKey();
    logger.info(`Building predictions for ${key}`);
    const summary = await buildPredictionSummary();
    await writeSummaryDoc(key, summary);
    logger.info(`Predictions written for ${key}`, { venues: Object.keys(summary.venues).length });
  }
);

/**
 * Manual backfill trigger:
 * GET /backfillPredictions?date=YYYYMMDD
 * If omitted, defaults to tonight.
 */
export const backfillPredictions = onRequest(async (req, res) => {
  try {
    const key = (req.query.date as string) || todayKey();
    logger.info(`Manual backfill start: ${key}`);
    const summary = await buildPredictionSummary();
    await writeSummaryDoc(key, summary);
    logger.info(`Manual backfill done: ${key}`, { venues: Object.keys(summary.venues).length });
    res.status(200).send({ ok: true, key, venues: Object.keys(summary.venues).length });
  } catch (e: any) {
    logger.error("Backfill failed", e);
    res.status(500).send({ ok: false, error: String(e?.message || e) });
  }
});
