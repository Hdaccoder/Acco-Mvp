export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const THRESHOLD = 3; // unique reporters

export async function POST() {
  try {
    const db = adminDb();

    // Gather reports in last 24h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const reports = await db
      .collection('housepartyReports')
      .where('createdAt', '>=', since)
      .get();

    const byParty = new Map<string, Set<string>>();
    reports.docs.forEach((r) => {
      const x = r.data() as any;
      const id = x.housepartyId as string;
      if (!id) return;
      const set = byParty.get(id) || new Set<string>();
      set.add(x.reporterUid || r.id); // count unique
      byParty.set(id, set);
    });

    let hidden = 0;
    for (const [id, set] of byParty) {
      if (set.size >= THRESHOLD) {
        await db.collection('houseparties').doc(id).set(
          { status: 'hidden', hiddenAt: new Date().toISOString() },
          { merge: true }
        );
        hidden++;
      }
    }

    return NextResponse.json({ hidden }, { status: 200 });
  } catch (e) {
    console.error('[POST /api/houseparty/moderate]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
