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

      <div className="grid gap-3">
        {sorted.map(([id, v]) => (
          <div
            key={id}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{VENUE_NAME[id] ?? id}</div>
              <div className="text-xs text-neutral-400">
                Typical peak: {v.typicalPeak ?? "—"}
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums">{v.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
