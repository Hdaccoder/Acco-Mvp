// src/app/predictions/PredictionsClient.tsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VENUES } from "@/lib/venues";
import { computePredictions, VenuePred } from "@/lib/predict";

type NightSummaryDoc = {
  venues: Record<string, { yes: number; maybe: number }>;
  createdAt?: any;
};

export default function PredictionsClient() {
  const [preds, setPreds] = useState<VenuePred[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!db) {
          setErr("Database not initialised. Check your .env.local values.");
          return;
        }
        const fdb = db as Firestore;

        // 1) Load all night doc IDs and take last ~56 (8 weeks)
        const nightsSnap = await getDocs(collection(fdb, "nights"));
        const ids = nightsSnap.docs
          .map((d) => d.id)
          .filter((k) => /^\d{8}$/.test(k))
          .sort();
        const lastKeys = ids.slice(-56);

        // 2) Fetch their summaries
        const summaries: Array<{
          dateKey: string;
          weekday: number;
          venues: Record<string, { yes: number; maybe: number }>;
        }> = [];

        for (const k of lastKeys) {
          const sRef = doc(fdb, "nights", k, "summary");
          const s = await getDoc(sRef);
          if (!s.exists()) continue;

          const data = s.data() as NightSummaryDoc;
          const dt = new Date(
            +k.slice(0, 4),
            +k.slice(4, 6) - 1,
            +k.slice(6, 8)
          );

          summaries.push({
            dateKey: k,
            weekday: dt.getDay(),
            venues: data.venues || {},
          });
        }

        // 3) Optional live boost from today's votes
        const today = new Date();
        const tk = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

        const todayVotesSnap = await getDocs(collection(fdb, "nights", tk, "votes"));
        const todayLive: Record<string, { yes: number; maybe: number }> = {};
        for (const v of VENUES) todayLive[v.id] = { yes: 0, maybe: 0 };

        todayVotesSnap.forEach((d) => {
          const v = d.data() as any;
          if (v.intent === "no") return;
          for (const s of v.selections ?? []) {
            if (!s?.venueId) continue;
            if (v.intent === "yes") todayLive[s.venueId].yes += 1;
            else if (v.intent === "maybe") todayLive[s.venueId].maybe += 1;
          }
        });

        // 4) Compute predictions
        const predictions = computePredictions(summaries, todayLive);
        setPreds(predictions);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  if (err) {
    const mailto =
      "mailto:paul.is.in.power@gmail.com" +
      "?subject=" +
      encodeURIComponent("Acco predictions error") +
      "&body=" +
      encodeURIComponent(
        `Error message: ${err}\n\nWhat were you doing when this happened?\n\nDevice/Browser (optional):\n\nScreenshot link (optional):`
      );

    return (
      <div className="p-4 text-red-300">
        Prediction error: {err}{" "}
        <a href={mailto} className="underline">
          Report issue
        </a>
        .
      </div>
    );
  }

  if (!preds) {
    return <div className="p-4 text-neutral-400">Calculating predictions…</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tonight’s Predictions</h1>
      <p className="text-sm text-neutral-400">
        Blended model using recent trend (EMA), same-weekday pattern, and early votes.
      </p>

      <div className="space-y-3">
        {preds.map((p) => (
          <div key={p.id} className="rounded-2xl border border-neutral-800 p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-neutral-400">
                {p.pred.toFixed(0)} / 100
                <span className="ml-2 text-neutral-500">
                  ({Math.round(100 * p.confidence)}% conf)
                </span>
              </div>
            </div>

            {/* bar with band */}
            <div className="mt-3 h-2 rounded bg-neutral-800 relative overflow-hidden">
              <div
                className="absolute left-0 h-2 bg-yellow-500/30"
                style={{ width: `${Math.min(100, p.high)}%` }}
              />
              <div
                className="absolute left-0 h-2 bg-yellow-400"
                style={{ width: `${Math.min(100, p.pred)}%` }}
              />
            </div>

            <div className="mt-2 text-xs text-neutral-500">
              EMA {p.ema.toFixed(1)} · DOW {p.dowMean.toFixed(1)} · Live {p.live.toFixed(1)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500">
        Questions or found a bug?{" "}
        <a
          className="underline"
          href={
            "mailto:paul.is.in.power@gmail.com" +
            "?subject=" +
            encodeURIComponent("Acco predictions feedback") +
            "&body=" +
            encodeURIComponent("Your feedback:")
          }
        >
          Email us
        </a>
        .
      </p>
    </div>
  );
}

