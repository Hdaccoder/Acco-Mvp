export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const decoded = idToken ? await adminAuth().verifyIdToken(idToken) : null;
    const uid = decoded?.uid ?? null;

    const { housepartyId, reason } = await req.json();
    if (!housepartyId || typeof housepartyId !== 'string') {
      return NextResponse.json({ error: 'housepartyId required' }, { status: 400 });
    }

    const db = adminDb();
    await db.collection('housepartyReports').add({
      housepartyId,
      reason: (reason || '').toString().slice(0, 140),
      reporterUid: uid,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/houseparty/report]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
