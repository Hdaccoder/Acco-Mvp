"use client";

import { useEffect, useMemo, useState } from "react";
import { confidenceLabels, formatUpdatedAt, type PredictionItem } from "@/lib/popularity";

type Venue = { id: string; name: string; city?: string };
type Props = { mode: "nightlife" | "food"; venues: Venue[] };
const trendLabel = { up: "Rising", steady: "Steady", down: "Cooling" } as const;
const FORECAST_WAIT_TIMEOUT_MS = 70_000;

export default function PredictionExplorer({ mode, venues }: Props) {
  const foodMode = mode === "food";
  const [items, setItems] = useState<Record<string, PredictionItem>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setPreparing(false);
      setError(null);
      try {
        const deadline = Date.now() + FORECAST_WAIT_TIMEOUT_MS;
        while (Date.now() < deadline) {
          const response = await fetch(`/api/predictions?mode=${mode}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const body = await response.json().catch(() => ({}));

          if (response.status === 202 && body.status === "generating") {
            if (!active) return;
            setPreparing(true);
            const retryAfterSeconds = Math.min(3, Math.max(1, Number(body.retryAfterSeconds) || 1));
            const waitMs = Math.min(retryAfterSeconds * 1000, Math.max(0, deadline - Date.now()));
            await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs));
            continue;
          }

          if (!response.ok) throw new Error(body.error || "Unable to load the forecast.");
          if (!active) return;
          setItems(body.items || {});
          setGeneratedAt(body.generatedAt || null);
          setDescription(body.modelDescription || "Historical popularity forecast.");
          return;
        }
        throw new Error("Forecast is taking longer than expected. Please try again in a moment.");
      } catch (caught) {
        if (active && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setError(caught instanceof Error ? caught.message : "Unable to load the forecast.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [mode, refreshToken]);

  const cities = useMemo(() => Array.from(new Set(venues.map((venue) => venue.city).filter((value): value is string => Boolean(value)))).sort(), [venues]);
  const venueIndex = useMemo(() => Object.fromEntries(venues.map((venue) => [venue.id, venue])), [venues]);
  const results = useMemo(() => Object.entries(items)
    .filter(([id]) => !city || venueIndex[id]?.city === city)
    .sort((a, b) => a[1].rank - b[1].rank), [city, items, venueIndex]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-medium text-yellow-300">Tonight&apos;s forecast</p>
        <h1 className="text-3xl font-bold tracking-tight">What is likely to be popular?</h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-300">
          The forecast combines same-weekday history, recent momentum, time decay, and venue baselines. The score is a relative index—not a percentage chance.
        </p>
        {description && <p className="text-xs text-neutral-500">Model: {description}</p>}
        <p className="text-xs text-neutral-400">{formatUpdatedAt(generatedAt)}</p>
      </header>

      <div className="max-w-sm">
        <label htmlFor={`${mode}-forecast-city`} className="mb-1 block text-sm text-neutral-300">Filter by town or city</label>
        <select id={`${mode}-forecast-city`} value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2">
          <option value="">All listed areas</option>
          {cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <p className="text-sm text-neutral-300">{preparing ? "Preparing tonight's forecast from local history…" : "Loading tonight's forecast…"}</p>
          {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-neutral-900 motion-reduce:animate-none" />)}
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} className="min-h-11 rounded-lg border border-amber-200/50 px-3 font-medium text-amber-50 hover:bg-amber-100/10">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <p className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-300">No forecast is available for this area yet.</p>
      )}

      <div className="grid gap-4">
        {results.map(([id, item], localIndex) => {
          const venue = venueIndex[id];
          if (!venue) return null;
          return (
            <article key={id} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-yellow-300">#{localIndex + 1} in {city || "listed areas"}</p>
                  <h2 className="mt-1 text-lg font-semibold">{venue.name}</h2>
                  <p className="text-sm text-neutral-400">{venue.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">{item.score}<span className="text-sm font-normal text-neutral-400">/100</span></p>
                  <p className="text-xs text-neutral-500">Forecast index</p>
                </div>
              </div>
              <meter className="popularity-meter mt-4 h-3 w-full" min="0" max="100" value={item.score} aria-label={`${venue.name} forecast index ${item.score} out of 100`} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-neutral-500">Confidence</dt><dd>{confidenceLabels[item.confidence]}</dd></div>
                <div><dt className="text-xs text-neutral-500">Trend</dt><dd>{trendLabel[item.trend]}</dd></div>
                <div><dt className="text-xs text-neutral-500">Typical peak</dt><dd>{item.typicalPeak || "Not known"}</dd></div>
                <div><dt className="text-xs text-neutral-500">Evidence</dt><dd>{item.observedVotes} votes / {item.sampleDays} days</dd></div>
                {foodMode && item.avgPrice != null && <div><dt className="text-xs text-neutral-500">Average spend</dt><dd>£{item.avgPrice}</dd></div>}
              </dl>
            </article>
          );
        })}
      </div>

      <aside className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs leading-5 text-neutral-400">
        Confidence reflects the amount and spread of historical evidence. Forecasts can be wrong, especially when events, weather, promotions, or venue closures change normal patterns.
      </aside>
    </div>
  );
}
