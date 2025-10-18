// src/lib/peaks.ts
export const WINDOW_ORDER = ["20-21", "21-22", "22-23", "23-24"] as const;
export type ArrivalWindow = (typeof WINDOW_ORDER)[number];

export type NightSummary = {
  date: string; // 'YYYYMMDD'
  dow?: number; // 0-6 (UTC)
  windows?: {
    byVenue?: {
      [venueId: string]: Partial<Record<ArrivalWindow, number>>;
    };
  };
};

// Gentle recency decay: idx=0 is most recent summary
function weightForIndex(idx: number) {
  return 1 / (1 + idx * 0.35);
}

export function bestWindowForVenue(
  summaries: NightSummary[],
  venueId: string
): ArrivalWindow | null {
  const scores: Record<ArrivalWindow, number> = {
    "20-21": 0,
    "21-22": 0,
    "22-23": 0,
    "23-24": 0,
  };

  summaries.forEach((s, i) => {
    const w = weightForIndex(i);
    const buckets = s.windows?.byVenue?.[venueId];
    if (!buckets) return;
    for (const key of WINDOW_ORDER) {
      const n = buckets[key] ?? 0;
      scores[key] += w * n;
    }
  });

  let best: ArrivalWindow | null = null;
  let bestVal = -1;
  for (const key of WINDOW_ORDER) {
    if (scores[key] > bestVal) {
      bestVal = scores[key];
      best = key;
    }
  }
  return bestVal > 0 ? best : null;
}

export function niceWindowLabel(w?: ArrivalWindow | null) {
  return w ? `Peak: ${w.replace("-", "–")}` : "Peak: —";
}

export function sameWeekdayOnly(
  summaries: NightSummary[],
  todayDow?: number
) {
  if (todayDow == null) return summaries;
  return summaries.filter((s) => s.dow === todayDow);
}
