// src/lib/predict.ts
import { VENUES } from "@/lib/venues";

export type VenuePred = {
  id: string;
  name: string;
  pred: number;     // 0..100
  low: number;      // lower bound
  high: number;     // upper bound
  ema: number;      // recent strength
  dowMean: number;  // same weekday strength
  live: number;     // today boost
  confidence: number; // 0.3..1
};

function ema(values: number[], lambda = 0.6) {
  if (values.length === 0) return 0;
  // assume array oldest -> newest
  let e = values[0];
  for (let i = 1; i < values.length; i++) {
    e = lambda * values[i] + (1 - lambda) * e;
  }
  return e;
}

export function computePredictions(
  summaries: Array<{
    dateKey: string;                           // YYYYMMDD
    weekday: number;                           // 0..6
    venues: Record<string, { yes: number; maybe: number }>;
  }>,
  todayLive: Record<string, { yes: number; maybe: number }> = {},
  weights = { alpha: 0.6, beta: 0.35, gamma: 0.05 }
) : VenuePred[] {
  const todayW = new Date().getDay();

  // Collect per-venue series
  const byVenue: Record<string, { recent: number[]; dow: number[] }> = {};
  for (const v of VENUES) byVenue[v.id] = { recent: [], dow: [] };

  for (const s of summaries) {
    for (const v of VENUES) {
      const entry = s.venues[v.id];
      const score = entry ? entry.yes + 0.5 * entry.maybe : 0;
      byVenue[v.id].recent.push(score);
      if (s.weekday === todayW) byVenue[v.id].dow.push(score);
    }
  }

  const raw: Array<{ id: string; name: string; value: number; ema: number; dow: number; live: number; n: number }> = [];

  for (const v of VENUES) {
    const r = byVenue[v.id].recent.slice(-14); // last 14 nights
    const d = byVenue[v.id].dow.slice(-8);     // last 8 same-weekdays
    const e = r.length ? ema(r) : 0;
    const m = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;

    const liveSrc = todayLive[v.id] || { yes: 0, maybe: 0 };
    const live = Math.min(5, liveSrc.yes + 0.5 * liveSrc.maybe); // small, capped early boost

    const value = weights.alpha * e + weights.beta * m + weights.gamma * live;
    raw.push({ id: v.id, name: v.name, value, ema: e, dow: m, live, n: r.length + d.length });
  }

  const maxV = Math.max(1, ...raw.map(x => x.value));
  const preds: VenuePred[] = raw.map(x => {
    const base = 100 * (x.value / maxV) * 0.95;  // normalize to ~95 max
    const confidence = Math.max(0.3, Math.min(1, Math.log(1 + x.n) / Math.log(31))); // 0.3..1
    const low  = base * (0.85 - 0.15 * (1 - confidence));
    const high = base * (1.15 + 0.15 * (1 - confidence));
    return {
      id: x.id, name: x.name,
      pred: base, low, high,
      ema: x.ema, dowMean: x.dow, live: x.live,
      confidence
    };
  });

  return preds.sort((a, b) => b.pred - a.pred);
}
