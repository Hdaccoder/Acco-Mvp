import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { nightKey } from "@/lib/dates";
import { VENUES } from "@/lib/venues";
import { FOOD_VENUES } from "@/lib/food_venues";
import { weight } from "@/lib/heat";
import { clientIp, rateLimit } from "@/lib/api-security";
import { liveConfidence, statusFromSignals, type PredictionItem, type Trend } from "@/lib/popularity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DATE_KEY = /^\d{8}$/;
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" };

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitude = radians(b.lat - a.lat);
  const longitude = radians(b.lng - a.lng);
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(`tallies:${clientIp(req)}`, 120, 60_000);
  if (limited) return limited;
  const mode = req.nextUrl.searchParams.get("mode") === "food" ? "food" : "nightlife";
  const requestedNight = req.nextUrl.searchParams.get("night") || nightKey();
  if (!DATE_KEY.test(requestedNight)) return NextResponse.json({ ok: false, error: "Invalid night." }, { status: 400 });

  try {
    const collectionName = mode === "food" ? "food_nights" : "nights";
    const summaryName = mode === "food" ? "food_prediction_summaries" : "prediction_summaries";
    const venueList = mode === "food" ? FOOD_VENUES : VENUES;
    const venueIndex = Object.fromEntries(venueList.map((venue) => [venue.id, venue]));
    const [voteSnap, predictionSnap] = await Promise.all([
      adminDb().collection(collectionName).doc(requestedNight).collection("votes").get(),
      adminDb().collection(summaryName).doc(requestedNight).get(),
    ]);
    const predictions = (predictionSnap.data()?.items || {}) as Record<string, PredictionItem>;
    const raw: Record<string, { voters: number; weighted: number; priceSum: number; priceCount: number }> = {};
    const arrivalCounts: Record<string, Record<string, number>> = {};
    let yesMaybe = 0;
    let no = 0;
    let totalSelections = 0;
    const now = Date.now();

    voteSnap.forEach((document) => {
      const vote = document.data();
      const intent = vote.intent === "maybe" || vote.intent === "no" ? vote.intent : "yes";
      if (intent === "no") {
        no += 1;
        return;
      }
      yesMaybe += 1;
      if (!Array.isArray(vote.selections)) return;
      for (const selection of vote.selections) {
        const venueId = typeof selection?.venueId === "string" ? selection.venueId : "";
        const venue = venueIndex[venueId];
        if (!venue) continue;
        totalSelections += 1;
        raw[venueId] ??= { voters: 0, weighted: 0, priceSum: 0, priceCount: 0 };
        raw[venueId].voters += 1;
        const updated = selection.updatedAt?.toDate?.() || vote.lastEditedAt?.toDate?.() || null;
        const minutes = updated instanceof Date ? Math.max(0, Math.round((now - updated.getTime()) / 60_000)) : 0;
        const location = vote.location;
        const meters = location && typeof location.lat === "number" && typeof location.lng === "number" ? distanceMeters(location, venue) : 99999;
        raw[venueId].weighted += weight({ intent, metersFromVenue: meters, updatedAgoMinutes: minutes });
        if (typeof selection.price === "number" && selection.price >= 0) {
          raw[venueId].priceSum += selection.price;
          raw[venueId].priceCount += 1;
        }
        if (typeof selection.arrivalWindow === "string") {
          arrivalCounts[venueId] ??= {};
          arrivalCounts[venueId][selection.arrivalWindow] = (arrivalCounts[venueId][selection.arrivalWindow] || 0) + 1;
        }
      }
    });

    const combined = venueList.map((venue) => {
      const tally = raw[venue.id] || { voters: 0, weighted: 0, priceSum: 0, priceCount: 0 };
      const forecastIndex = predictions[venue.id]?.score || Math.round(((venue.baseline || 5) / 10) * 65);
      const trend: Trend = predictions[venue.id]?.trend || "steady";
      const liveAverage = tally.voters ? tally.weighted / tally.voters : 0;
      const reliability = tally.voters / (tally.voters + 5);
      const signal = reliability * liveAverage + (1 - reliability) * (forecastIndex / 100);
      return { venue, tally, forecastIndex, trend, signal };
    });
    const maxSignal = Math.max(0.01, ...combined.map((item) => item.signal));
    const tallies = Object.fromEntries(combined.map(({ venue, tally, forecastIndex, trend, signal }) => {
      const index = Math.round((signal / maxSignal) * 100);
      return [venue.id, {
        voters: tally.voters,
        weighted: Math.round(tally.weighted * 100) / 100,
        price: tally.priceCount ? Math.round(tally.priceSum / tally.priceCount) : null,
        index,
        confidence: liveConfidence(tally.voters),
        status: statusFromSignals(tally.voters, index, forecastIndex, trend),
        forecastIndex,
        trend,
      }];
    }));

    return NextResponse.json({
      ok: true,
      night: requestedNight,
      generatedAt: new Date().toISOString(),
      totalParticipants: voteSnap.size,
      totalSelections,
      tallies,
      arrivalCounts,
      sentiment: { yesMaybe, no },
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[GET /api/tallies]", error);
    return NextResponse.json({ ok: false, error: "Unable to load live popularity." }, { status: 500 });
  }
}
