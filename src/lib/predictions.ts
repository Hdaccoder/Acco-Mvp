import { adminDb } from "@/lib/firebase-admin";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { FOOD_VENUES } from "@/lib/food_venues";
import { VENUES } from "@/lib/venues";
import { confidenceFromSample, type PredictionItem, type Trend } from "@/lib/popularity";
import { dateFromNightKey } from "@/lib/dates";

function addDays(date: Date, delta: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + delta);
  return copy;
}

function keyFromDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function dateFromKey(key: string) {
  return dateFromNightKey(key);
}

export type PredictionMode = "nightlife" | "food";
type Accumulator = {
  same: number;
  recent: number;
  observedVotes: number;
  sampleDays: Set<string>;
  arrivals: Record<string, number>;
  priceSum: number;
  priceCount: number;
};

export async function generatePrediction(targetNightKey: string, mode: PredictionMode) {
  const db = adminDb();
  const targetDate = dateFromKey(targetNightKey);
  const collectionName = mode === "food" ? "food_nights" : "nights";
  const venues = mode === "food" ? FOOD_VENUES : VENUES;
  const accumulators: Record<string, Accumulator> = Object.fromEntries(venues.map((venue) => [venue.id, {
    same: 0,
    recent: 0,
    observedVotes: 0,
    sampleDays: new Set<string>(),
    arrivals: {},
    priceSum: 0,
    priceCount: 0,
  }]));

  const dayWeights = new Map<string, { same: number; recent: number }>();
  for (let week = 1; week <= 8; week += 1) {
    const key = keyFromDate(addDays(targetDate, -7 * week));
    dayWeights.set(key, { same: 0.6 * Math.pow(0.88, week - 1), recent: dayWeights.get(key)?.recent || 0 });
  }
  for (let day = 1; day <= 14; day += 1) {
    const key = keyFromDate(addDays(targetDate, -day));
    const current = dayWeights.get(key) || { same: 0, recent: 0 };
    current.recent = 0.4 * Math.pow(0.92, day - 1);
    dayWeights.set(key, current);
  }

  await Promise.all([...dayWeights.entries()].map(async ([key, weights]) => {
    const snap = await db.collection(collectionName).doc(key).collection("votes").get();
    snap.forEach((document) => {
      const vote = document.data();
      if (vote.intent === "no" || !Array.isArray(vote.selections)) return;
      const intentWeight = vote.intent === "maybe" ? 0.6 : 1;
      for (const selection of vote.selections) {
        const venueId = typeof selection?.venueId === "string" ? selection.venueId : "";
        const acc = accumulators[venueId];
        if (!acc) continue;
        acc.same += weights.same * intentWeight;
        acc.recent += weights.recent * intentWeight;
        acc.observedVotes += 1;
        acc.sampleDays.add(key);
        if (typeof selection.arrivalWindow === "string") {
          acc.arrivals[selection.arrivalWindow] = (acc.arrivals[selection.arrivalWindow] || 0) + 1;
        }
        if (typeof selection.price === "number" && selection.price >= 0) {
          acc.priceSum += selection.price;
          acc.priceCount += 1;
        }
      }
    });
  }));

  const raw = venues.map((venue) => {
    const acc = accumulators[venue.id];
    const historicalSignal = acc.same + acc.recent;
    const prior = Math.max(0, Math.min(1, (venue.baseline || 5) / 10));
    const evidenceWeight = Math.min(1, acc.observedVotes / 15);
    const smoothed = historicalSignal > 0
      ? evidenceWeight * historicalSignal + (1 - evidenceWeight) * prior
      : prior * 0.65;
    const sameAverage = acc.same / Math.max(1, acc.observedVotes);
    const recentAverage = acc.recent / Math.max(1, acc.observedVotes);
    const difference = recentAverage - sameAverage;
    const trend: Trend = difference > 0.035 ? "up" : difference < -0.035 ? "down" : "steady";
    const typicalPeak = Object.entries(acc.arrivals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { venue, acc, smoothed, trend, typicalPeak };
  });

  const maxSignal = Math.max(0.01, ...raw.map((item) => item.smoothed));
  const ranked = raw
    .map((item) => ({ ...item, score: Math.round((item.smoothed / maxSignal) * 100) }))
    .sort((a, b) => b.score - a.score || b.acc.observedVotes - a.acc.observedVotes);

  const items: Record<string, PredictionItem> = {};
  ranked.forEach((item, index) => {
    items[item.venue.id] = {
      score: item.score,
      rank: index + 1,
      confidence: confidenceFromSample(item.acc.observedVotes, item.acc.sampleDays.size),
      observedVotes: item.acc.observedVotes,
      sampleDays: item.acc.sampleDays.size,
      typicalPeak: item.typicalPeak,
      trend: item.trend,
      ...(mode === "food" ? { avgPrice: item.acc.priceCount ? Math.round(item.acc.priceSum / item.acc.priceCount) : null } : {}),
    };
  });

  return {
    generatedAt: Timestamp.now(),
    targetNightKey,
    modelVersion: 2,
    modelDescription: "Same-weekday history, recent trend, time decay, venue baseline, and sample-size smoothing.",
    items,
    top: ranked.slice(0, 10).map((item) => item.venue.id),
  };
}

export async function generatePredictionForNight(targetNightKey: string) {
  return generatePrediction(targetNightKey, "nightlife");
}

export async function generateFoodPredictionForNight(targetNightKey: string) {
  return generatePrediction(targetNightKey, "food");
}

export async function writePrediction(nightKey: string, payload: DocumentData) {
  await adminDb().collection("prediction_summaries").doc(nightKey).set(payload, { merge: true });
}

export async function writeFoodPrediction(nightKey: string, payload: DocumentData) {
  await adminDb().collection("food_prediction_summaries").doc(nightKey).set(payload, { merge: true });
}

const GENERATION_LEASE_MS = 60_000;

type ForecastLeaseClaim =
  | { status: "ready"; data: DocumentData }
  | { status: "generating"; retryAfterMs: number }
  | { status: "claimed" };

type ForecastFinalization =
  | { status: "written" }
  | { status: "ready"; data: DocumentData }
  | { status: "generating"; retryAfterMs: number };

export type EnsuredPrediction =
  | { status: "ready"; data: DocumentData; generatedOnDemand: boolean }
  | { status: "generating"; retryAfterSeconds: number };

function isStoredForecast(data: DocumentData | undefined): data is DocumentData {
  return Boolean(data && data.items && typeof data.items === "object" && !Array.isArray(data.items));
}

function timestampMillis(value: unknown) {
  return value instanceof Timestamp ? value.toMillis() : 0;
}

/**
 * Returns a saved forecast, creating the current one exactly once when no cron
 * summary exists yet. The Firestore lease prevents concurrent first visitors
 * from all running the historical-data scan.
 */
export async function ensurePredictionForNight(targetNightKey: string, mode: PredictionMode): Promise<EnsuredPrediction> {
  const db = adminDb();
  const summaryCollection = mode === "food" ? "food_prediction_summaries" : "prediction_summaries";
  const summaryRef = db.collection(summaryCollection).doc(targetNightKey);
  const leaseRef = db.collection("forecast_generation_locks").doc(`${mode}-${targetNightKey}`);
  const leaseId = randomUUID();
  const startedAt = Date.now();

  const claim = await db.runTransaction<ForecastLeaseClaim>(async (transaction) => {
    const [summarySnapshot, leaseSnapshot] = await Promise.all([
      transaction.get(summaryRef),
      transaction.get(leaseRef),
    ]);
    const existing = summarySnapshot.data();
    if (isStoredForecast(existing)) return { status: "ready", data: existing };

    const leaseExpiresAt = timestampMillis(leaseSnapshot.data()?.expiresAt);
    if (leaseExpiresAt > startedAt) {
      return { status: "generating", retryAfterMs: leaseExpiresAt - startedAt };
    }

    transaction.set(leaseRef, {
      owner: leaseId,
      mode,
      targetNightKey,
      startedAt: Timestamp.fromMillis(startedAt),
      expiresAt: Timestamp.fromMillis(startedAt + GENERATION_LEASE_MS),
    });
    return { status: "claimed" };
  });

  if (claim.status === "ready") {
    return { status: "ready", data: claim.data, generatedOnDemand: false };
  }

  if (claim.status === "generating") {
    return {
      status: "generating",
      retryAfterSeconds: Math.min(3, Math.max(1, Math.ceil(claim.retryAfterMs / 1000))),
    };
  }

  const releaseLease = async () => {
    await db.runTransaction(async (transaction) => {
      const lease = await transaction.get(leaseRef);
      if (lease.data()?.owner === leaseId) transaction.delete(leaseRef);
    });
  };

  try {
    const prediction = await generatePrediction(targetNightKey, mode);
    const finalization = await db.runTransaction<ForecastFinalization>(async (transaction) => {
      const [summarySnapshot, leaseSnapshot] = await Promise.all([
        transaction.get(summaryRef),
        transaction.get(leaseRef),
      ]);
      const existing = summarySnapshot.data();
      const lease = leaseSnapshot.data();

      if (isStoredForecast(existing)) {
        if (lease?.owner === leaseId) transaction.delete(leaseRef);
        return { status: "ready", data: existing };
      }

      if (lease?.owner !== leaseId) {
        return {
          status: "generating",
          retryAfterMs: Math.max(0, timestampMillis(lease?.expiresAt) - Date.now()),
        };
      }

      transaction.set(summaryRef, prediction, { merge: true });
      transaction.delete(leaseRef);
      return { status: "written" };
    });

    if (finalization.status === "ready") {
      return { status: "ready", data: finalization.data, generatedOnDemand: false };
    }

    if (finalization.status === "generating") {
      return {
        status: "generating",
        retryAfterSeconds: Math.min(3, Math.max(1, Math.ceil(finalization.retryAfterMs / 1000))),
      };
    }

    return { status: "ready", data: prediction, generatedOnDemand: true };
  } catch (error) {
    try {
      await releaseLease();
    } catch (releaseError) {
      console.error("[forecast generation lease cleanup]", releaseError);
    }
    throw error;
  }
}
