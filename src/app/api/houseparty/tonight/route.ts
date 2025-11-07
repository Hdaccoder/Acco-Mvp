export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { nightKey } from '@/lib/dates';

export async function GET() {
  try {
    const nk = nightKey(new Date());
    const snap = await adminDb()
      .collection('houseparties')
      .where('nightKey', '==', nk)
      .where('status', '==', 'active')
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    console.error('[GET /api/houseparty/tonight]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
