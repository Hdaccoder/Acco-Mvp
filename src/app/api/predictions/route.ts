import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { nightKey } from "@/lib/dates";
import { clientIp, rateLimit } from "@/lib/api-security";
import { ensurePredictionForNight } from "@/lib/predictions";
import type { DocumentData } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DATE_KEY = /^\d{8}$/;

type StoredItem = {
  score?: unknown;
  rank?: unknown;
  confidence?: unknown;
  observedVotes?: unknown;
  sampleDays?: unknown;
  typicalPeak?: unknown;
  trend?: unknown;
  avgPrice?: unknown;
};

function isStoredForecast(data: DocumentData | undefined): data is DocumentData {
  return Boolean(data && data.items && typeof data.items === "object" && !Array.isArray(data.items));
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(`predictions:${clientIp(req)}`, 120, 60_000);
  if (limited) return limited;
  const mode = req.nextUrl.searchParams.get("mode") === "food" ? "food" : "nightlife";
  const currentNight = nightKey();
  const requestedNight = req.nextUrl.searchParams.get("night") || currentNight;
  if (!DATE_KEY.test(requestedNight)) return NextResponse.json({ ok: false, error: "Invalid night." }, { status: 400 });
  try {
    const collectionName = mode === "food" ? "food_prediction_summaries" : "prediction_summaries";
    const snap = await adminDb().collection(collectionName).doc(requestedNight).get();
    const stored = snap.data();
    let data: DocumentData;
    let generatedOnDemand = false;

    if (isStoredForecast(stored)) {
      data = stored;
    } else {
      // Generating arbitrary dates from a public endpoint would allow expensive
      // history scans on demand. The forecast pages only need the current night.
      if (requestedNight !== currentNight) {
        return NextResponse.json({ ok: false, error: "Forecast not available yet." }, { status: 404 });
      }
      const ensured = await ensurePredictionForNight(requestedNight, mode);
      if (ensured.status === "generating") {
        return NextResponse.json({
          ok: false,
          status: "generating",
          error: "Preparing tonight's forecast.",
          retryAfterSeconds: ensured.retryAfterSeconds,
        }, {
          status: 202,
          headers: { "Cache-Control": "no-store" },
        });
      }
      data = ensured.data;
      generatedOnDemand = ensured.generatedOnDemand;
    }

    const sourceItems = (data.items || {}) as Record<string, StoredItem>;
    const sorted = Object.entries(sourceItems).sort((a, b) => Number(b[1].score || 0) - Number(a[1].score || 0));
    const items = Object.fromEntries(sorted.map(([id, item], index) => [id, {
      score: Number(item.score || 0),
      rank: Number(item.rank || index + 1),
      confidence: item.confidence === "high" || item.confidence === "medium" ? item.confidence : "low",
      observedVotes: Number(item.observedVotes || 0),
      sampleDays: Number(item.sampleDays || 0),
      typicalPeak: typeof item.typicalPeak === "string" ? item.typicalPeak : null,
      trend: item.trend === "up" || item.trend === "down" ? item.trend : "steady",
      ...(typeof item.avgPrice === "number" ? { avgPrice: item.avgPrice } : {}),
    }]));
    const generatedAt = data.generatedAt?.toDate?.()?.toISOString?.() || null;
    return NextResponse.json({
      ok: true,
      targetNightKey: requestedNight,
      generatedAt,
      modelVersion: data.modelVersion || 1,
      modelDescription: data.modelDescription || "Historical popularity forecast.",
      generatedOnDemand,
      items,
      top: data.top || [],
    }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (error) {
    console.error("[GET /api/predictions]", error);
    return NextResponse.json({ ok: false, error: "Unable to load forecast." }, { status: 500 });
  }
}
