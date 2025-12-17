// src/app/api/admin/houseparties/moderate/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Manual moderation endpoint used by the admin UI.
 *
 * Expected JSON body:
 * {
 *   "id": "HOUSEPARTY_DOC_ID",
 *   "action": "approve" | "reject"
 * }
 *
 * Writes with Admin SDK (bypasses client rules).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = (body?.id || '').toString();
    const action = (body?.action || '').toString();

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const status = action === 'approve' ? 'active' : 'rejected';

    const db = adminDb();
    await db.collection('houseparties').doc(id).set(
      {
        status,
        reviewedAt: new Date().toISOString(),
        // Optional: add more audit fields later if you want:
        // reviewedBy: { uid: ..., email: ... }
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, id, status }, { status: 200 });
  } catch (e) {
    console.error('[POST /api/admin/houseparties/moderate]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

