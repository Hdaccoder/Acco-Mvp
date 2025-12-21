export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { nightKey } from '@/lib/dates';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const decoded = idToken ? await adminAuth().verifyIdToken(idToken) : null;
    const uid = decoded?.uid ?? null;

    const { venueId, reason } = await req.json();
    if (!venueId || typeof venueId !== 'string') {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 });
    }

    const db = adminDb();
    const nk = nightKey(new Date());
    await db.collection('venueReports').add({
      venueId,
      reason: (reason || '').toString().slice(0, 140),
      reporterUid: uid,
      nightKey: nk,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/venue/report]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
