"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { nightKey } from "@/lib/dates";

type PredictedVenue = {
  id: string;
  name: string;
  score: number;       // 0–100
  peakLabel?: string;  // e.g., "22–23"
};

export default function PredictionsClient() {
  const [items, setItems] = useState<PredictedVenue[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!db) throw new Error("DB not initialised");

        const nk = nightKey();
        const ref = doc(db, "prediction_summaries", nk);
        const snap = await getDoc(ref);

        if (cancelled) return;

        if (!snap.exists()) {
          setErr("No predictions yet for tonight.");
          setItems([]);
          setLoading(false);
          return;
        }

        const data = snap.data() || {};
        const list: PredictedVenue[] = (data.predictions ?? []).map((p: any) => ({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          score: Number(p.score ?? 0),
          peakLabel: typeof p.peakLabel === "string" ? p.peakLabel : undefined,
        }));

        setItems(list);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "Prediction load failed.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-neutral-300">
        Loading predictions…
      </div>
    );
  }

  if (err) {
    return (
      <p className="text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3">
        Prediction error: {err}
      </p>
    );
  }

  if (!items.length) {
    return <p className="text-neutral-400 text-sm">No predictions yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {items.map((p) => (
        <div key={p.id} className="rounded-xl bg-neutral-900/60 p-4 border border-neutral-800">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{p.name}</h3>
            <span className="text-sm text-neutral-300">{p.score}</span>
          </div>
          {p.peakLabel && (
            <p className="text-xs text-neutral-400 mt-1">Typical peak: {p.peakLabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}
