"use client";

import { useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { nightKey } from "@/lib/dates";
import { ensureAnon } from "@/lib/auth";

/**
 * Best-effort writer that creates prediction_summaries/{YYYYMMDD}
 * exactly once per night (rules enforce "first writer wins").
 */
export default function EnsureSummary() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureAnon();
        if (!db) return;

        const nk = nightKey(); // e.g. "20251017"
        const ref = doc(db, "prediction_summaries", nk);

        const snap = await getDoc(ref);
        if (cancelled) return;

        if (!snap.exists()) {
          await setDoc(ref, {
            date: nk,
            version: 1,
            createdAt: serverTimestamp(),
            computedAt: serverTimestamp(),
            predictions: [], // You can fill this later from a job/Cloud Function.
            ready: true,
            source: "ensure-summary@client",
          });
        }
      } catch {
        // Swallow; this is best-effort and safe to ignore.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
