"use client";
export const dynamic = "force-dynamic";

import NextDynamic from "next/dynamic";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { ensureAnon } from "@/lib/auth";
import { nightKey } from "@/lib/dates";
import { VENUES } from "@/lib/venues";
import VenueCard from "@/components/VenueCard";
import { weight } from "@/lib/heat";

// Map only on client
const MapView = NextDynamic(() => import("@/components/MapView"), {
  ssr: false,
});

type Vote = {
  intent: "yes" | "maybe" | "no";
  selections: { venueId: string; arrivalWindow?: string; updatedAt?: any }[];
  location?: { lat: number; lng: number; accuracy?: number | null } | null;
  lastEditedAt?: any;
};

const VENUE_INDEX = Object.fromEntries(VENUES.map((v) => [v.id, v]));

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
}

export default function TonightPage() {
  const [tallies, setTallies] = useState<
    Record<string, { voters: number; weighted: number }>
  >({});
  const [sentiment, setSentiment] = useState<{ yesMaybe: number; no: number }>({
    yesMaybe: 0,
    no: 0,
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    let mounted = true;

    (async () => {
      await ensureAnon();

      if (!db) {
        setErr("Database not initialised. Check your .env.local values.");
        return;
      }

      const nk = nightKey();
      const qref = collection(db, "nights", nk, "votes");

      unsub = onSnapshot(
        query(qref),
        (snap) => {
          if (!mounted) return;
          const now = Date.now();
          const t: Record<string, { voters: number; weighted: number }> = {};
          let yesMaybe = 0;
          let no = 0;

          snap.forEach((d) => {
            const v = d.data() as Vote;
            if (!v) return;

            if (v.intent === "no") {
              no += 1;
              return;
            }
            yesMaybe += 1;

            const editedMs =
              (v.lastEditedAt?.toMillis && v.lastEditedAt.toMillis()) || now;
            const updatedAgoMinutes = Math.max(
              1,
              Math.round((now - editedMs) / 60000)
            );

            for (const sel of v.selections || []) {
              const venue = VENUE_INDEX[sel.venueId];
              if (!venue) continue;

              const meters = v.location
                ? haversineMeters(
                    { lat: v.location.lat, lng: v.location.lng },
                    { lat: venue.lat, lng: venue.lng }
                  )
                : 1000;

              const w = weight({
                intent: v.intent === "maybe" ? "maybe" : "yes",
                metersFromVenue: meters,
                updatedAgoMinutes,
              });

              if (!t[sel.venueId]) t[sel.venueId] = { voters: 0, weighted: 0 };
              t[sel.venueId].voters += 1;
              t[sel.venueId].weighted += w;
            }
          });

          setTallies(t);
          setSentiment({ yesMaybe, no });
          setErr(null);
        },
        (e) => setErr(e.message)
      );
    })();

    return () => {
      mounted = false;
      try {
        unsub();
      } catch {}
    };
  }, []);

  // Compute the top venue by raw voter count (only if > 0)
  const topVenueId = useMemo(() => {
    let best: { id: string; voters: number } | null = null;
    for (const [id, t] of Object.entries(tallies)) {
      if (!best || t.voters > best.voters) best = { id, voters: t.voters };
    }
    return best && best.voters > 0 ? best.id : null;
  }, [tallies]);

  const totalSentiment = sentiment.yesMaybe + sentiment.no;
  const stayInPct =
    totalSentiment > 0 ? Math.round((sentiment.no / totalSentiment) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tonight in Ormskirk</h1>

      {err ? (
        <p className="text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3">
          Live data error: {err}
        </p>
      ) : (
        <p className="text-neutral-400 text-sm">
          Live popularity based on local votes. Cast yours on the{" "}
          <a href="/vote" className="underline">
            Vote
          </a>{" "}
          page.
        </p>
      )}

      {totalSentiment > 0 && (
        <p className="text-sm text-neutral-300">
          Crowd sentiment:{" "}
          <span className="font-medium">{stayInPct}%</span> say they’re staying
          in.
        </p>
      )}

      <MapView topVenueId={topVenueId} />

      <div className="grid gap-3">
        {VENUES.map((v) => {
          const t = tallies[v.id] || { voters: 0, weighted: 0 };
          // Bars start empty until there are votes
          const score0to100 =
            t.voters === 0 ? 0 : Math.min(100, Math.round(t.weighted * 10));

          return (
            <VenueCard
             key={v.id}
             id={v.id}
             name={v.name}
             voters={t.voters}
             heatScore={score0to100}
             lat={v.lat}                 // ⬅️ add
             lng={v.lng}                 // ⬅️ add
            />
          );
        })}
      </div>

      {/* Floating Vote button for quick access */}
      <a
        href="/vote"
        className="fixed bottom-5 right-5 px-4 py-2 rounded-xl bg-yellow-400 text-black shadow-lg hover:opacity-90"
      >
        Vote tonight
      </a>
    </div>
  );
}
