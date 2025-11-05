// src/app/api/houseparty/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin'; // <- your helper
import { prepareHouseparty } from '@/lib/houseparty';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const data = prepareHouseparty(json);

    const db = adminDb(); // <- your singleton Firestore (Admin)
    const ref = await db.collection('houseparties').add(data);

    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (err: any) {
    console.error('[houseparty POST]', err);
    const msg = err?.message || 'Invalid request';
    return new NextResponse(msg, { status: 400 });
  }
}
