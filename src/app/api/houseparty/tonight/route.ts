// src/app/api/houseparty/tonight/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { nightKey } from '@/lib/dates';

export async function GET() {
  try {
    const db = adminDb();
    const nk = nightKey(new Date());

    // Admin SDK query for tonight's active houseparties
    const snap = await db
      .collection('houseparties')
      .where('nightKey', '==', nk)
      .where('status', 'in', ['active', null]) // tolerate missing status
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    console.error('[GET /api/houseparty/tonight]', err);
    return new NextResponse('Failed to load houseparties', { status: 500 });
  }
}
