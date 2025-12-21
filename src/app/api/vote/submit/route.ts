import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { idToken, baseNights, nightKey, vote } = body as any;
    if (!idToken) return NextResponse.json({ ok: false, error: 'missing idToken' }, { status: 400 });
    if (!baseNights || !nightKey || !vote) return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });

    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    if (!uid) return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 401 });

    const db = adminDb();
    const docRef = db.doc(`${baseNights}/${nightKey}/votes/${uid}`);
    // Ensure fields required by rules are present
    const toWrite = {
      ...vote,
      userId: uid,
      nightKey,
      createdAt: vote.createdAt ? new Date(vote.createdAt) : new Date(),
      lastEditedAt: new Date(),
    };

    await docRef.set(toWrite, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('submit vote (server) error', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
