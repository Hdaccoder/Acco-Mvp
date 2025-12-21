// src/app/predictions/PredictionsClient.tsx
"use client";

import { useEffect, useState } from "react";
import { VENUES } from "@/lib/venues";
import { db } from "@/lib/firebase";
import type { Firestore } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";

const VENUE_NAME = Object.fromEntries(VENUES.map(v => [v.id, v.name]));

function nightKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

type PredItems = Record<
  string,
  {
    score: number;
    typicalPeak: string | null;
  }
>;

export default function PredictionsClient() {
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<PredItems>({});
  const [topIds, setTopIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // --- guard: ensure db is initialised ---
        if (!db) {
          setErr("Database not initialised. Check your .env values or Firebase client setup.");
          setLoading(false);
          return;
        }
        const fdb = db as Firestore;

        const nk = nightKey(); // tonight
        const ref = doc(fdb, "prediction_summaries", nk);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // try to trigger generation on-demand, then re-fetch
          try {
            await fetch('/api/ensure-summary/trigger', { method: 'POST' });
            const reSnap = await getDoc(ref);
            if (reSnap.exists()) {
              const data = reSnap.data() as any;
              setItems((data.items || {}) as PredItems);
              setTopIds((data.top || []) as string[]);
              setErr(null);
              setLoading(false);
              return;
            }
          } catch (e) {
            // ignore and fallthrough to error
          }

          setErr("No predictions yet for tonight.");
          setLoading(false);
          return;
        }

        const data = snap.data() as any;
        setItems((data.items || {}) as PredItems);
        setTopIds((data.top || []) as string[]);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load predictions.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = Object.entries(items).sort((a, b) => b[1].score - a[1].score);

  const cities = Array.from(new Set(VENUES.map((v) => v.city).filter(Boolean))).sort();
  const byCity = (c?: string | null) => {
    if (!c) return sorted;
    const venueIds = new Set(VENUES.filter((v) => v.city === c).map((v) => v.id));
    return sorted.filter(([id]) => venueIds.has(id));
  };
  const cityList = byCity(city);
  const topInCity = cityList.length > 0 ? cityList[0] : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tonight’s top picks</h1>
      <p className="text-neutral-400 text-sm">
        We blend live votes with recent nights to predict what’s most likely to be
        popular. Each card shows a score (0–100) and a typical peak time.
      </p>

      {loading && <p className="text-sm text-neutral-400">Loading predictions…</p>}

      {err && !loading && (
        <p className="text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3">
          Prediction error: {err}
        </p>
      )}

      {!loading && !err && sorted.length === 0 && (
        <p className="text-sm text-neutral-400">No prediction items yet.</p>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-400">Choose city:</label>
          <select value={city ?? ""} onChange={(e) => setCity(e.target.value || null)} className="bg-neutral-900 border border-neutral-800 p-2 rounded">
            <option value="">All regions</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {topInCity ? (
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
            <div className="text-sm text-yellow-300">Tonight in {city ?? 'your area'}</div>
            <div className="text-2xl font-bold mt-2">{VENUES.find(v=>v.id===topInCity[0])?.name ?? topInCity[0]} is Acco tonight!</div>
            <div className="text-sm text-neutral-300 mt-2">Typical peak: <span className="font-medium">{topInCity[1].typicalPeak ?? '—'}</span></div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">No predicted leaders for this city yet.</div>
        )}

        <div className="grid gap-3">
          {cityList.slice(0).map(([id, v]) => (
            <div key={id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{VENUE_NAME[id] ?? id}</div>
                  <div className="text-xs text-neutral-400">Typical peak: {v.typicalPeak ?? '—'}</div>
                </div>
                <div className="text-sm text-neutral-300">{v.score > 0 ? `${v.score}%` : 'Low'}</div>
              </div>
              <div className="text-xs text-neutral-500 mt-2">Other times: {/* placeholder - arrival windows not in summary */}—</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
