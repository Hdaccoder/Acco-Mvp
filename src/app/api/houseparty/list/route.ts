// src/app/api/houseparty/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { nightKey } from '@/lib/dates';

function lastNights(n = 7) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(nightKey(d));
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get('range') || 'tonight') as
      | 'tonight'
      | 'recent';

    const db = adminDb();

    if (range === 'tonight') {
      const nk = nightKey(new Date());

      // Order by newest created; switch to 'startsAtTs' if you prefer start-time sorting.
      const snap = await db
        .collection('houseparties')
        .where('nightKey', '==', nk)
        .orderBy('createdAt', 'desc') // or .orderBy('startsAtTs', 'desc')
        .get();

      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ items }, { status: 200 });
    }

    // recent = last 7 nights
    const keys = lastNights(7);

    // Newest night first, then newest post within each night.
    const snap = await db
      .collection('houseparties')
      .where('nightKey', 'in', keys)
      .orderBy('nightKey', 'desc')
      .orderBy('createdAt', 'desc') // or 'startsAtTs'
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    console.error('[GET /api/houseparty/list] error:', err);
    return NextResponse.json(
      { error: 'Failed to load houseparties.' },
      { status: 500 }
    );
  }
}
