export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { nightKey as nkFn } from '@/lib/dates';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const forKey = url.searchParams.get('for');
    const windowHoursParam = url.searchParams.get('windowHours');
    const windowHours = windowHoursParam ? Math.max(1, Number(windowHoursParam) || 48) : 48;

    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    const db = adminDb();
    let q: any = db.collection('venueReports').where('createdAt', '>=', sinceIso);
    if (forKey) q = q.where('nightKey', '==', forKey);
    const snap = await q.get();

    const byVenue: Record<string, { count: number; entries: { reason: string; createdAt: string; reporterUid?: string }[] }> = {};
    snap.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const vid = String(data.venueId || '');
      if (!byVenue[vid]) byVenue[vid] = { count: 0, entries: [] };
      byVenue[vid].count += 1;
      byVenue[vid].entries.push({ reason: String(data.reason || ''), createdAt: String(data.createdAt || ''), reporterUid: data.reporterUid || undefined });
    });

    return NextResponse.json({ reportsByVenue: byVenue, windowHours, since: sinceIso });
  } catch (e) {
    console.error('[GET /api/venue/reports]', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
