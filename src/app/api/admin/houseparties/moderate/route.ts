// src/app/api/admin/houseparties/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function listFromEnv(v?: string | null) {
  return (v || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const authz = req.headers.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const decoded = await adminAuth().verifyIdToken(token);
    const email = decoded.email || '';
    const uid = decoded.uid;

    const allowedEmails = listFromEnv(process.env.NEXT_PUBLIC_ADMIN_EMAILS);
    const allowedUids   = listFromEnv(process.env.NEXT_PUBLIC_ADMIN_UIDS);

    const isAllowed = (email && allowedEmails.includes(email)) || (allowedUids.length > 0 && allowedUids.includes(uid));
    if (!isAllowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, action } = await req.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const db = adminDb();
    await db.collection('houseparties').doc(id).set(
      {
        status: action === 'approve' ? 'active' : 'rejected',
        moderatedAt: new Date().toISOString(),
        moderatedBy: { uid, email },
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/moderate]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
