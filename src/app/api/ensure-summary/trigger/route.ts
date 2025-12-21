import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generatePredictionForNight, writePrediction, nightKey } from '@/lib/predictions';

export async function POST(req: Request) {
  try {
    const nowKey = nightKey();
    const db = adminDb();
    const ref = db.collection('prediction_summaries').doc(nowKey);
    const snap = await ref.get();
    if (snap.exists) {
      return NextResponse.json({ ok: true, existing: true });
    }

    // generate and write prediction. This endpoint is intentionally permissive
    // but only writes if missing (race-safe: subsequent writes merge).
    const out = await generatePredictionForNight(nowKey);
    await writePrediction(nowKey, out);
    return NextResponse.json({ ok: true, generated: true });
  } catch (e: any) {
    console.error('trigger ensure-summary error', e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
