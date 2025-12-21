export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { nightKey } from '@/lib/dates';

function addDays(d: Date, delta: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + delta);
  return c;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const nk = url.searchParams.get('night') || nightKey(new Date());

    const lookbackDays = Number(url.searchParams.get('days') || 7); // default 7 days relevance

    const db = adminDb();

    // tallies per venue
    const tallies: Record<string, { voters: number; weighted: number; price?: number | null }> = {};

    // iterate over requested night and previous (lookbackDays - 1) nights
    const y = Number(nk.slice(0, 4));
    const m = Number(nk.slice(4, 6)) - 1;
    const d = Number(nk.slice(6, 8));
    const startDate = new Date(y, m, d);

    for (let i = 0; i < lookbackDays; i++) {
      const date = addDays(startDate, -i);
      const key = nightKey(date);
      const snap = await db.collection('food_nights').doc(key).collection('votes').get();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (!data || data.intent !== 'yes' || !Array.isArray(data.selections)) return;

        for (const s of data.selections) {
          if (!s || !s.venueId) continue;
          const id = s.venueId;
          tallies[id] ??= { voters: 0, weighted: 0, price: null };
          tallies[id].voters += 1;
          tallies[id].weighted += 1; // simple count weighting
          if (typeof s.price === 'number') {
            if (tallies[id].price == null) tallies[id].price = s.price;
            else tallies[id].price = Math.round(((tallies[id].price as number) * (tallies[id].voters - 1) + s.price) / tallies[id].voters);
          }
        }
      });
    }

    return NextResponse.json({ ok: true, night: nk, lookbackDays, tallies });
  } catch (e: any) {
    console.error('[GET /api/food/tallies]', e);
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
