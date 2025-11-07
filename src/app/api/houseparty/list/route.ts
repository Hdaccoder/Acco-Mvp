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
    const range = (searchParams.get('range') || 'tonight') as 'tonight' | 'recent';
    const db = adminDb();

    if (range === 'tonight') {
      const nk = nightKey(new Date());
      const snap = await db
        .collection('houseparties')
        .where('nightKey', '==', nk)
        .where('status', '==', 'active')
        .get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ items }, { status: 200 });
    }

    const keys = lastNights(7);
    const snap = await db
      .collection('houseparties')
      .where('nightKey', 'in', keys)
      .where('status', '==', 'active')
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => {
        const ta = a?.startsAt ? Date.parse(a.startsAt) : 0;
        const tb = b?.startsAt ? Date.parse(b.startsAt) : 0;
        return tb - ta;
      });

    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    console.error('[GET /api/houseparty/list]', err);
    return NextResponse.json({ error: 'Failed to load houseparties' }, { status: 500 });
  }
}
