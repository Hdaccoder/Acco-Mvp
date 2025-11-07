// src/app/api/houseparty/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { nightKey } from '@/lib/dates';

const BAD = [/fuck/i, /shit/i, /cunt/i, /nazi/i, /rape/i];

function clean(s?: string, max = 140) {
  if (!s) return '';
  let t = s.replace(/\p{Extended_Pictographic}/gu, ''); // strip emoji
  if (BAD.some((r) => r.test(t))) throw new Error('Inappropriate content.');
  return t.trim().slice(0, max);
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const sin = Math.sin;
  const cos = Math.cos;
  const h = sin(dφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)); // metres
}

const ORMSKIRK = { lat: 53.569, lng: -2.881 };
const RADIUS_M = 5500; // 5.5 km

export async function POST(req: Request) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    const decoded = await adminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // Body
    const body = await req.json();

    const kind =
      body.kind && ['pres', 'afters', 'all-night'].includes(body.kind) ? body.kind : 'all-night';

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!isFinite(+startsAt) || !isFinite(+endsAt) || +endsAt <= +startsAt) {
      return NextResponse.json({ error: 'Invalid time window' }, { status: 400 });
    }

    const now = new Date();
    const nk = nightKey(now);
    if (nightKey(startsAt) !== nk || nightKey(endsAt) !== nk) {
      return NextResponse.json({ error: 'Only tonight is allowed' }, { status: 400 });
    }

    const location = { lat: Number(body.location?.lat), lng: Number(body.location?.lng) };
    if (!isFinite(location.lat) || !isFinite(location.lng)) {
      return NextResponse.json({ error: 'Location required' }, { status: 400 });
    }
    if (haversine(location, ORMSKIRK) > RADIUS_M) {
      return NextResponse.json({ error: 'Outside allowed area' }, { status: 400 });
    }

    const name = clean(body.name, 50);
    const address = clean(body.address, 120);
    const notes = clean(body.notes, 300);

    const db = adminDb();

    // quota per user per night
    const qRef = db.collection('meta').doc(`hpQuota:${nk}:${uid}`);
    const qSnap = await qRef.get();
    const used = (qSnap.exists ? qSnap.data()?.count : 0) || 0;
    if (used >= 2) {
      return NextResponse.json({ error: 'Rate limit reached for tonight' }, { status: 429 });
    }

    // near-duplicate (150m & overlapping time)
    const near = await db.collection('houseparties').where('nightKey', '==', nk).get();
    const overlap = (a: Date, b: Date, c: Date, d: Date) => +a < +d && +c < +b;
    const dup = near.docs.some((d) => {
      const x = d.data() as any;
      if (!x?.location) return false;
      const dist = haversine(location, x.location);
      return dist < 150 && overlap(startsAt, endsAt, new Date(x.startsAt), new Date(x.endsAt));
    });
    if (dup) {
      return NextResponse.json({ error: 'Similar event already exists nearby' }, { status: 409 });
    }

    // trust gate
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const trustScore = userSnap.exists ? userSnap.data()?.trustScore ?? 0 : 0;
    const status = trustScore >= 3 ? 'active' : 'pending';

    const doc = {
      name,
      kind,
      address,
      notes,
      location,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      nightKey: nk,
      authorUid: uid,
      createdAt: new Date().toISOString(),
      status,
      uaHash: (req.headers.get('user-agent') || '').slice(0, 120),
      ipHint: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()?.slice(0, 7) || null,
    };

    const ref = await db.collection('houseparties').add(doc);
    await qRef.set({ count: used + 1, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ id: ref.id, status }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/houseparty/create]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
