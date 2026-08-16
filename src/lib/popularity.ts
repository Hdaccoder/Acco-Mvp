export type Confidence = "low" | "medium" | "high";
export type Trend = "up" | "steady" | "down";
export type PopularityStatus = "popular" | "trending" | "usual" | "early" | "quiet";

export type PredictionItem = {
  score: number;
  rank: number;
  confidence: Confidence;
  observedVotes: number;
  sampleDays: number;
  typicalPeak: string | null;
  trend: Trend;
  avgPrice?: number | null;
};

export type PublicTally = {
  voters: number;
  weighted: number;
  price?: number | null;
  index: number;
  confidence: Confidence;
  status: PopularityStatus;
  forecastIndex: number;
  trend: Trend;
};

export function confidenceFromSample(votes: number, sampleDays = 1): Confidence {
  if (votes >= 30 && sampleDays >= 6) return "high";
  if (votes >= 10 && sampleDays >= 3) return "medium";
  return "low";
}

export function liveConfidence(votes: number): Confidence {
  if (votes >= 20) return "high";
  if (votes >= 6) return "medium";
  return "low";
}

export function statusFromSignals(votes: number, index: number, forecastIndex: number, trend: Trend): PopularityStatus {
  if (votes < 3) return forecastIndex >= 60 ? "usual" : "early";
  if (index >= 70) return "popular";
  if (trend === "up" && index >= 45) return "trending";
  if (forecastIndex >= 60) return "usual";
  return "quiet";
}

export const statusLabels: Record<PopularityStatus, string> = {
  popular: "Popular now",
  trending: "Trending up",
  usual: "Usually popular",
  early: "Not enough live data",
  quiet: "Quieter right now",
};

export const confidenceLabels: Record<Confidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function formatUpdatedAt(value: string | null, now = Date.now()) {
  if (!value) return "Update time unavailable";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Update time unavailable";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 15) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}
