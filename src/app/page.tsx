"use client";
import NextDynamic from "next/dynamic";
import { collection, onSnapshot, query, where, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db, getClientDb } from "@/lib/firebase";
import { ensureAnon } from "@/lib/auth";
import { nightKey } from "@/lib/dates";
import { VENUES } from "@/lib/venues";
import VenueCard from "@/components/VenueCard";
import { weight } from "@/lib/heat";

// Map only on client
const MapView = NextDynamic(() => import("@/components/MapView"), { ssr: false });

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

function computeTopRanks(
  tallies: Record<string, { voters: number; weighted: number }> ,
  city?: string | null
) {
  const entries = Object.entries(tallies)
    .filter(([, t]) => t.voters > 0)
    .filter(([id]) => {
      if (!city) return true;
      const v = VENUE_INDEX[id];
      return v?.city === city;
    })
    .sort(([, a], [, b]) => {
      const byV = b.voters - a.voters;
      if (byV !== 0) return byV;
      return b.weighted - a.weighted;
    });

  const ranks: Record<string, 1 | 2 | 3> = {};
  let prevKey: string | null = null;
  let rank = 1 as 1 | 2 | 3;
  let stoppedForTie = false;

  const keyOf = (t: { voters: number; weighted: number }) =>
    `${t.voters}|${Math.round(t.weighted * 1000)}`;

  for (const [id, t] of entries) {
    if (rank > 3) break;
    const k = keyOf(t);

    if (prevKey !== null && k === prevKey) {
      stoppedForTie = true;
      break;
    }

    ranks[id] = rank;
    prevKey = k;
    rank = (rank + 1) as 1 | 2 | 3;
  }

  const topIds = {
    gold: Object.keys(ranks).find((id) => ranks[id] === 1) ?? null,
    silver: Object.keys(ranks).find((id) => ranks[id] === 2) ?? null,
    bronze: Object.keys(ranks).find((id) => ranks[id] === 3) ?? null,
  };

  return {
    ranks,
    topIds,
    stoppedForTie,
    leadersCount: Object.keys(ranks).length,
  };

}

// Page component
export default function Page() {
  // Local UI state (initialized minimally so component compiles)
  const [tallies, setTallies] = useState<Record<string, { voters: number; weighted: number }>>({});
  const [arrivalCounts, setArrivalCounts] = useState<Record<string, Record<string, number>>>({});
  const [dangerScores, setDangerScores] = useState<Record<string, number>>({});
  const [sentiment, setSentiment] = useState<{ yesMaybe: number; no: number }>({ yesMaybe: 0, no: 0 });
  const [predItems, setPredItems] = useState<Record<string, { score: number; typicalPeak?: string | null }>>({});
  const [err, setErr] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [radiusM, setRadiusM] = useState<number>(10000);

  // read persisted city choice
  useEffect(() => {
    try {
      const v = localStorage.getItem('userCity');
      if (v) setUserCity(v);
    } catch {}
  }, []);

  // persist city choice
  useEffect(() => {
    try {
      if (userCity) localStorage.setItem('userCity', userCity);
      else localStorage.removeItem('userCity');
    } catch {}
  }, [userCity]);

  // Heat score (0-100) per venue from tallies
  const heatScores = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, t] of Object.entries(tallies)) {
      out[id] = Math.min(100, Math.round((t.weighted ?? 0) * 10));
    }
    return out;
  }, [tallies]);

  // Request device location once on mount (used only on homepage to show nearby venues)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const opts: PositionOptions = { enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60 * 1000 };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      opts
    );
  }, []);

  // Derive user city from nearest known venue (fallback region)
  useEffect(() => {
    if (!userLocation) return;
    let nearest: { city?: string; dist: number } | null = null;
    for (const v of VENUES) {
      const d = haversineMeters(userLocation, { lat: v.lat, lng: v.lng });
      if (!nearest || d < nearest.dist) nearest = { city: v.city, dist: d };
    }
    if (nearest && nearest.city && nearest.dist < 100000) {
      setUserCity(nearest.city);
    } else {
      setUserCity(null);
    }
  }, [userLocation]);

  // persist radius to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem('nearbyRadiusM', String(radiusM));
    } catch {}
  }, [radiusM]);

  function requestLocation() {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn('location denied', err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  // Order venues by heat (desc)
  const orderedVenues = useMemo(() => {
    const vs = [...VENUES];
    vs.sort((a, b) => {
      const ha = heatScores[a.id] ?? 0;
      const hb = heatScores[b.id] ?? 0;
      return hb - ha;
    });

    // If we know the user's city, show the top 5 popular places in that city.
    if (userCity) {
      return vs.filter((v) => v.city === userCity).slice(0, 5);
    }

    // Otherwise, show the top 5 venues overall.
    return vs.slice(0, 5);
  }, [heatScores]);

  // If we have a device location, compute the top venues within `radiusM` by popularity (then proximity)
  const nearbyTop5 = useMemo(() => {
    if (!userLocation) return null;
    const list = VENUES.map((v) => {
      const d = haversineMeters(userLocation, { lat: v.lat, lng: v.lng });
      const heat = heatScores[v.id] ?? 0;
      return { ...v, dist: d, heat };
    })
      .filter((x) => x.dist <= radiusM)
      .sort((a, b) => {
        const byHeat = b.heat - a.heat;
        if (byHeat !== 0) return byHeat;
        return a.dist - b.dist;
      });

    return list;
  }, [userLocation, heatScores, radiusM]);

  // When no device location, allow filtering by selected city
  const filteredVenues = useMemo(() => {
    if (userLocation) return nearbyTop5 ?? VENUES;
    if (userCity) return VENUES.filter((v) => v.city === userCity);
    return VENUES;
  }, [userLocation, nearbyTop5, userCity]);

  // Compute top ranks (tie-safe)
  const { ranks, stoppedForTie, leadersCount } = useMemo(
    () => computeTopRanks(tallies, userCity ?? undefined),
    [tallies, userCity]
  );

  // Compute "Peak tonight" label from today's arrival windows
  const todayPeakLabel = (venueId: string): string | null => {
    const counts = arrivalCounts[venueId];
    if (!counts) return null;
    let best: { key: string; n: number } | null = null;
    for (const [k, n] of Object.entries(counts)) {
      if (!best || n > best.n) best = { key: k, n };
    }
    return best?.key ?? null;
  };

  // fetch nightly prediction summary (best-effort)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const nk = nightKey();
        if (!db) return;
        const ref = doc(db, 'prediction_summaries', nk);
        const snap = await getDoc(ref);
        if (!active) return;
        if (!snap.exists()) return;
        const data = snap.data() as any;
        setPredItems((data.items || {}) as Record<string, { score: number; typicalPeak?: string | null }>);
      } catch (e) {
        // ignore
      }
    })();
    return () => { active = false; };
  }, []);

  // Real-time votes aggregation for tonight (food + nightlife)
  useEffect(() => {
    if (!db) return;
    let active = true;

    const nk = nightKey();

    // recompute by reading both votes subcollections
    const recompute = async () => {
      try {
        const snaps = await Promise.all([
          getDocs(collection(getClientDb(), "nights", nk, "votes")),
          getDocs(collection(getClientDb(), "food_nights", nk, "votes")),
        ]);

        if (!active) return;

        const docs = snaps.flatMap((s) => s.docs.map((d) => d.data()));
        const now = new Date();

        const newTallies: Record<string, { voters: number; weighted: number }> = {};
        const newArrival: Record<string, Record<string, number>> = {};
        let yesMaybe = 0;
        let no = 0;

        for (const raw of docs as any[]) {
          const intent: "yes" | "maybe" | "no" = raw.intent || "yes";

          if (intent === "no") {
            no += 1;
          } else {
            yesMaybe += 1;
          }

          const loc = raw.location && raw.location.lat != null && raw.location.lng != null ? { lat: raw.location.lat, lng: raw.location.lng } : null;

          const selections = Array.isArray(raw.selections) ? raw.selections : [];

          for (const sel of selections) {
            const vid = sel.venueId;
            if (!vid) continue;

            if (!newTallies[vid]) newTallies[vid] = { voters: 0, weighted: 0 };
            newTallies[vid].voters += 1;

            // arrival window counts
            const aw = sel.arrivalWindow || "unspecified";
            newArrival[vid] = newArrival[vid] || {};
            newArrival[vid][aw] = (newArrival[vid][aw] || 0) + 1;

            // compute weighted contribution for yes/maybe
            if (intent === "yes" || intent === "maybe") {
              const venue = VENUE_INDEX[vid];
              const metersFromVenue = loc && venue ? haversineMeters(loc, { lat: venue.lat, lng: venue.lng }) : 99999;

              let updatedAt: Date | null = null;
              if (sel.updatedAt && typeof sel.updatedAt.toDate === "function") {
                updatedAt = sel.updatedAt.toDate();
              } else if (raw.lastEditedAt && typeof raw.lastEditedAt.toDate === "function") {
                updatedAt = raw.lastEditedAt.toDate();
              } else if (sel.updatedAt && typeof sel.updatedAt === "number") {
                updatedAt = new Date(sel.updatedAt);
              }

              const updatedAgoMinutes = updatedAt ? Math.max(0, Math.round((now.getTime() - updatedAt.getTime()) / 60000)) : 0;

              const w = weight({ intent, metersFromVenue, updatedAgoMinutes });
              newTallies[vid].weighted += w;
            }
          }
        }

        if (!active) return;
        setTallies(newTallies);
        setArrivalCounts(newArrival);
        setSentiment({ yesMaybe, no });
        // keep dangerScores at zero for now
        setDangerScores({});
      } catch (e: any) {
        console.warn('recompute votes failed', e);
        setErr(String(e?.message || e));
      }
    };

    // initial recompute
    recompute();

    // listen for changes and trigger recompute when either collection updates
    const unsub1 = onSnapshot(collection(getClientDb(), "nights", nk, "votes"), () => recompute(), (err) => setErr(String(err?.message || err)));
    const unsub2 = onSnapshot(collection(getClientDb(), "food_nights", nk, "votes"), () => recompute(), (err) => setErr(String(err?.message || err)));

    return () => {
      active = false;
      try { unsub1(); } catch {}
      try { unsub2(); } catch {}
    };
  }, []);

  const totalSentiment = sentiment.yesMaybe + sentiment.no;
  const stayInPct =
    totalSentiment > 0 ? Math.round((sentiment.no / totalSentiment) * 100) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tonight in {userCity ?? 'the North West'}</h1>

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

      {/* Map with colored ranks */}
      <MapView ranks={ranks} venues={filteredVenues} tallies={tallies} userLoc={userLocation} />

      {/* Small hint for ties / not enough leaders */}
      {(stoppedForTie || leadersCount < 3) && (
        <p className="text-xs text-neutral-500">
          {stoppedForTie
            ? "A tie means only clear leaders are highlighted."
            : "Fewer than three places have votes yet."}
        </p>
      )}

      {/* Location prompt / radius controls */}
      <div className="mb-4">
        {!userLocation ? (
          <div className="rounded-md p-3 bg-neutral-900 border border-neutral-800 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Show nearby places</div>
                <div className="text-neutral-400 text-xs">Allow location to see the 5 closest popular places near you.</div>
              </div>
              <div>
                <button onClick={requestLocation} className="px-3 py-1 rounded-md bg-yellow-400 text-black">Allow location</button>
              </div>
            </div>
            <div className="mt-3 text-sm">
              <label className="block text-neutral-400 text-xs">Or pick a city</label>
              <select
                value={userCity ?? ''}
                onChange={(e) => setUserCity(e.target.value || null)}
                className="mt-1 w-full bg-neutral-800 rounded px-2 py-1"
              >
                <option value="">All regions</option>
                {Array.from(new Set(VENUES.map((v) => v.city))).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="rounded-md p-3 bg-neutral-900 border border-neutral-800 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Nearby radius</div>
              <div className="text-neutral-400 text-xs">Showing places within your selected range.</div>
            </div>
            <div className="flex items-center gap-2">
              {[5000, 10000, 25000, 50000, 100000].map((r) => {
                const mi = r >= 1609 ? Math.round(r / 1609.34) : null;
                return (
                  <button
                    key={r}
                    onClick={() => setRadiusM(r)}
                    className={`px-2 py-1 rounded ${radiusM === r ? 'bg-yellow-400 text-black' : 'bg-neutral-800'}`}
                  >
                    {mi ? `${mi}mi` : `${r}m`}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {userLocation && (
          <div className="text-sm text-neutral-400">
          Showing <span className="font-medium">{(nearbyTop5 ?? []).length}</span> {(nearbyTop5 ?? []).length === 1 ? 'place' : 'places'} within <span className="font-medium">{radiusM >= 1609 ? `${Math.round(radiusM / 1609.34)}mi` : `${radiusM}m`}</span>
        </div>
      )}

      <div className="grid gap-3">
          {(userLocation ? (nearbyTop5 ?? []) : filteredVenues).map((v: any) => {
          const t = tallies[v.id] || { voters: 0, weighted: 0 };
          const score0to100 = heatScores[v.id] ?? 0;
          const arrival = arrivalCounts[v.id] || {};
          const popularTimes = Object.entries(arrival).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
          const pred = predItems[v.id];
          return (
            <VenueCard
              key={v.id}
              id={v.id}
              name={v.name}
              voters={t.voters}
              heatScore={score0to100}
              lat={v.lat}
              lng={v.lng}
              peakToday={todayPeakLabel(v.id)}
              dangerScore={dangerScores[v.id] ?? 0}
              nightMeta={{ popularDay: pred?.typicalPeak ?? todayPeakLabel(v.id) ?? undefined, popularTimes }}
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
