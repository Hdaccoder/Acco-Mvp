import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

function addDays(d: Date, delta: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}
function weekdayIndex(d: Date) {
  return d.getDay();
}

function nightKeyFromDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export async function generatePredictionForNight(targetNightKey: string) {
  const db = adminDb();

  const USE_WEEKS = 8;
  const RECENT_DAYS = 14;
  const ALPHA_SAME_WEEKDAY = 0.6;
  const ALPHA_RECENT_TREND = 0.4;

  const y = Number(targetNightKey.slice(0, 4));
  const m = Number(targetNightKey.slice(4, 6)) - 1;
  const d = Number(targetNightKey.slice(6, 8));
  const targetDate = new Date(y, m, d);

  const sameWeekdayKeys: string[] = [];
  for (let w = 1; w <= USE_WEEKS; w++) {
    const date = addDays(targetDate, -7 * w);
    sameWeekdayKeys.push(nightKeyFromDate(date));
  }

  const recentKeys: string[] = [];
  for (let i = 1; i <= RECENT_DAYS; i++) {
    const date = addDays(targetDate, -i);
    recentKeys.push(nightKeyFromDate(date));
  }

  const venueCountSame: Record<string, number> = {};
  const venueCountRecent: Record<string, number> = {};
  const arrivalCount: Record<string, Record<string, number>> = {};

  async function tallyNight(nk: string, bucket: Record<string, number>) {
    const snap = await db.collection('nights').doc(nk).collection('votes').get();
    snap.forEach((d) => {
      const v = d.data() as any;
      if (!v || v.intent === 'no' || !Array.isArray(v.selections)) return;
      for (const s of v.selections) {
        const vid = s.venueId;
        if (!vid) continue;
        bucket[vid] = (bucket[vid] ?? 0) + 1;
        if (s.arrivalWindow) {
          arrivalCount[vid] ??= {};
          arrivalCount[vid][s.arrivalWindow] = (arrivalCount[vid][s.arrivalWindow] ?? 0) + 1;
        }
      }
    });
  }

  await Promise.all(sameWeekdayKeys.map((nk) => tallyNight(nk, venueCountSame)));
  await Promise.all(recentKeys.map((nk) => tallyNight(nk, venueCountRecent)));

  function normalise(map: Record<string, number>) {
    const max = Math.max(1, ...Object.values(map));
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) out[k] = v / max;
    return out;
  }
  const normSame = normalise(venueCountSame);
  const normRecent = normalise(venueCountRecent);

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
  for (const [id, v] of Object.entries(blended)) score0to100[id] = Math.round((v / maxBlend) * 100);

  const typicalPeak: Record<string, string | null> = {};
  for (const [vid, counts] of Object.entries(arrivalCount)) {
    let best: { k: string; n: number } | null = null;
    for (const [k, n] of Object.entries(counts)) {
      if (!best || n > best.n) best = { k, n };
    }
    typicalPeak[vid] = best?.k ?? null;
  }

  const top = Object.entries(score0to100).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 10);

  return {
    generatedAt: Timestamp.now(),
    targetNightKey,
    items: Object.fromEntries(Object.entries(score0to100).map(([id, score]) => [id, { score, typicalPeak: typicalPeak[id] ?? null }])),
    top,
  };
}

export async function writePrediction(nk: string, payload: any) {
  const db = adminDb();
  await db.collection('prediction_summaries').doc(nk).set(payload, { merge: true });
}

export function nightKey(date = new Date()) { return nightKeyFromDate(date); }
