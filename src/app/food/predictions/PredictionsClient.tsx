"use client";

import { useEffect, useState } from "react";
import { FOOD_VENUES } from "@/lib/food_venues";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function nightKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

type PredItems = Record<string, { score: number; typicalPeak: string | null }>;

export default function FoodPredictionsClient() {
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<PredItems>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!db) {
          setErr("Database not initialised.");
          setLoading(false);
          return;
        }
        const nk = nightKey();
        const ref = doc(db, "prediction_summaries", nk);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          // attempt on-demand generation via trigger endpoint then re-fetch
          try {
            await fetch('/api/food/ensure-summary/trigger', { method: 'POST' });
            const reSnap = await getDoc(ref);
            if (reSnap.exists()) {
              const data = reSnap.data() as any;
              const allItems: PredItems = data.items || {};
              const foodIds = new Set(FOOD_VENUES.map((v) => v.id));
              const filtered: PredItems = {};
              for (const [id, val] of Object.entries(allItems)) {
                if (foodIds.has(id)) filtered[id] = val as any;
              }
              setItems(filtered);
              setErr(null);
              setLoading(false);
              return;
            }
          } catch (e) {
            // ignore and fall through to error
          }

          setErr("No predictions yet for tonight.");
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        const allItems: PredItems = data.items || {};
        // Filter to food venues only
        const foodIds = new Set(FOOD_VENUES.map((v) => v.id));
        const filtered: PredItems = {};
        for (const [id, val] of Object.entries(allItems)) {
          if (foodIds.has(id)) filtered[id] = val as any;
        }
        setItems(filtered);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load predictions.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = Object.entries(items).sort((a, b) => b[1].score - a[1].score);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Food predictions</h1>
      <p className="text-neutral-400 text-sm">Predictions for food venues only.</p>

      {loading && <p className="text-sm text-neutral-400">Loading predictions…</p>}
      {err && !loading && (
        <p className="text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3">{err}</p>
      )}

      <div className="grid gap-3">
        {sorted.map(([id, v]) => (
          <div key={id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{FOOD_VENUES.find((x) => x.id === id)?.name ?? id}</div>
              <div className="text-xs text-neutral-400">Typical peak: {v.typicalPeak ?? "—"}</div>
            </div>
            <div className="text-lg font-semibold tabular-nums">{v.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
