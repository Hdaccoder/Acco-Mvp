import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

function addDays(d: Date, delta: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function nightKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export async function POST(req: Request) {
  try {
    const nowKey = nightKey();
    const db = adminDb();
    const ref = db.collection('food_prediction_summaries').doc(nowKey);
    const snap = await ref.get();
    if (snap.exists) return NextResponse.json({ ok: true, existing: true });

    // generate simple food summary by scanning past food_nights votes
    const USE_WEEKS = 8;
    const RECENT_DAYS = 14;
    const ALPHA_SAME_WEEKDAY = 0.6;
    const ALPHA_RECENT_TREND = 0.4;

    function keysForWeeks(targetDate: Date) {
      const keys: string[] = [];
      for (let w = 1; w <= USE_WEEKS; w++) keys.push(nightKey(addDays(targetDate, -7 * w)));
      return keys;
    }
    function keysForRecent(targetDate: Date) {
      const keys: string[] = [];
      for (let i = 1; i <= RECENT_DAYS; i++) keys.push(nightKey(addDays(targetDate, -i)));
      return keys;
    }

    const y = Number(nowKey.slice(0, 4));
    const m = Number(nowKey.slice(4, 6)) - 1;
    const d = Number(nowKey.slice(6, 8));
    const targetDate = new Date(y, m, d);

    const sameWeekdayKeys = keysForWeeks(targetDate);
    const recentKeys = keysForRecent(targetDate);

    const venueCountSame: Record<string, number> = {};
    const venueCountRecent: Record<string, number> = {};
    const priceSums: Record<string, { sum: number; n: number }> = {};

    async function tallyNight(nk: string, bucket: Record<string, number>, collectPrice = false) {
      const snap = await db.collection('food_nights').doc(nk).collection('votes').get();
      snap.forEach((d) => {
        const v = d.data() as any;
        if (!v || v.intent !== 'yes' || !Array.isArray(v.selections)) return;
        for (const s of v.selections) {
          const vid = s?.venueId;
          if (!vid) continue;
          bucket[vid] = (bucket[vid] ?? 0) + 1;
          if (collectPrice && typeof s.price === 'number') {
            priceSums[vid] ??= { sum: 0, n: 0 };
            priceSums[vid].sum += s.price;
            priceSums[vid].n += 1;
          }
        }
      });
    }

    await Promise.all(sameWeekdayKeys.map((k) => tallyNight(k, venueCountSame, true)));
    await Promise.all(recentKeys.map((k) => tallyNight(k, venueCountRecent, true)));

    function normalise(map: Record<string, number>) {
      const max = Math.max(1, ...Object.values(map));
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(map)) out[k] = v / max;
      return out;
    }

    const normSame = normalise(venueCountSame);
    const normRecent = normalise(venueCountRecent);

    const blended: Record<string, number> = {};
    const allIds = new Set([...Object.keys(normSame), ...Object.keys(normRecent), ...Object.keys(priceSums)]);
    for (const id of allIds) {
      const s = normSame[id] ?? 0;
      const r = normRecent[id] ?? 0;
      blended[id] = ALPHA_SAME_WEEKDAY * s + ALPHA_RECENT_TREND * r;
    }

    const maxBlend = Math.max(0.001, ...Object.values(blended));
    const score0to100: Record<string, number> = {};
    for (const [id, v] of Object.entries(blended)) score0to100[id] = Math.round((v / maxBlend) * 100);

    const avgPrice: Record<string, number | null> = {};
    for (const id of Object.keys(priceSums)) {
      const p = priceSums[id];
      avgPrice[id] = p.n > 0 ? Math.round(p.sum / p.n) : null;
    }

    const items = Object.fromEntries(
      Object.entries(score0to100).map(([id, score]) => [id, { score, avgPrice: avgPrice[id] ?? null }])
    );

    const top = Object.entries(score0to100).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 10);

    const payload = { generatedAt: Timestamp.now(), targetNightKey: nowKey, items, top };

    await ref.set(payload, { merge: true });
    return NextResponse.json({ ok: true, generated: true });
  } catch (e: any) {
    console.error('[POST /api/food/ensure-summary/trigger] error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
