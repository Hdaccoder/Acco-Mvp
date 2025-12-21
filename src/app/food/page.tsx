"use client";
import NextDynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { nightKey } from '@/lib/dates';
import { useUserLocation } from "@/hooks/useUserLocation";
import { FOOD_VENUES } from "@/lib/food_venues";
import VenueCard from "@/components/VenueCard";
import Link from "next/link";

const MapView = NextDynamic(() => import("@/components/MapView"), { ssr: false });

export default function FoodPage() {
  // Local UI state for food votes (mocked for now)
  const [tallies, setTallies] = useState<Record<string, { voters: number; weighted: number; price?: number | null }>>({});
  const { loc, requestLocation } = useUserLocation();
  const [userCity, setUserCity] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<number>(() => {
    try {
      const v = localStorage.getItem("foodRadiusMiles");
      if (v) return Number(v);
    } catch {}
    // default ~50 km -> miles
    return Math.round(50 * 0.621371);
  });
  const [topN, setTopN] = useState<number>(8);

  // Heat score (0-100) per venue from tallies
  const heatScores = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, t] of Object.entries(tallies)) {
      out[id] = Math.min(100, Math.round((t.weighted ?? 0) * 10));
    }
    return out;
  }, [tallies]);

  // TODO: Replace with real food voting logic
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/food/tallies');
        if (!active) return;
        if (!res.ok) {
          console.error('Failed to load food tallies', await res.text());
          return;
        }
        const body = await res.json();
        if (body?.tallies) setTallies(body.tallies);
      } catch (e) {
        console.error('Error fetching food tallies', e);
      }
    })();
    return () => { active = false; };
  }, []);

  // Derive user city from nearest food venue
  useEffect(() => {
    if (!loc) return;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const A = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(A));
    };

    let nearest: { city?: string; dist: number } | null = null;
    for (const v of FOOD_VENUES) {
      const d = haversine(loc, { lat: v.lat, lng: v.lng });
      if (!nearest || d < nearest.dist) nearest = { city: v.city, dist: d };
    }
    if (nearest && nearest.city && nearest.dist < 100000) setUserCity(nearest.city);
    else setUserCity('the North West');
  }, [loc]);

  // Filter venues by selected city or distance from user (configurable radius).
  // If a city is selected, always filter by that city regardless of location permission.
  const filteredVenues = useMemo(() => {
    if (userCity) {
      return FOOD_VENUES.filter((v) => v.city === userCity);
    }

    if (!loc) {
      return FOOD_VENUES;
    }

    const radiusMeters = Math.round(radiusMiles * 1609.34);
    const toRad = (x: number) => (x * Math.PI) / 180;
    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const A = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(A));
    };
    return FOOD_VENUES.filter((v) => haversine(loc, { lat: v.lat, lng: v.lng }) <= radiusMeters);
  }, [loc, radiusMiles, userCity]);

  // From filtered venues pick the top N by combined score (mock: baseline + weighted tallies)
  const topVenues = useMemo(() => {
    const scored = filteredVenues.map((v) => ({
      v,
      score: (tallies[v.id]?.weighted ?? 0) + (v.baseline ?? 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map((s) => s.v);
  }, [filteredVenues, tallies, topN]);

  const [foodPredItems, setFoodPredItems] = useState<Record<string, { score: number; avgPrice?: number | null }>>({});

  // fetch food prediction summary for tonight
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const nk = nightKey();
        const res = await fetch(`/api/food/ensure-summary?for=${nk}`);
        if (!active) return;
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.out?.items && !body?.out && body?.targetKey) {
          // Some routes return out, others return document directly
        }
        const items = body?.out?.items ?? body?.out ?? body?.items ?? null;
        if (items) setFoodPredItems(items);
      } catch (e) {
        // ignore
      }
    })();
    return () => { active = false; };
  }, []);

  // Compute ranks for the venues based on tallies (1,2,3) — tie-safe
  function computeTopRanks(
    tallies: Record<string, { voters: number; weighted: number; price?: number | null }>
  ) {
    const entries = Object.entries(tallies)
      .filter(([, t]) => t.voters > 0)
      .filter(([id]) => topVenues.some((v) => v.id === id))
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

    return { ranks, topIds, stoppedForTie, leadersCount: Object.keys(ranks).length };
  }

  const { ranks, stoppedForTie, leadersCount } = useMemo(() => computeTopRanks(tallies), [tallies, topVenues]);

  // persist radius to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem("foodRadiusMiles", String(radiusMiles));
    } catch {}
  }, [radiusMiles]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Food in {userCity ?? 'the North West'}</h1>

      <p className="text-neutral-400 text-sm">
        Live popularity based on local votes. Cast yours on the {" "}
        <Link href="/food/vote" className="underline">Vote</Link> page.
      </p>
      {/* Map with colored ranks */}
      <MapView ranks={ranks} venues={filteredVenues} tallies={tallies} userLoc={loc} foodMode />

      {/* Small hint for ties / not enough leaders */}
      {(stoppedForTie || leadersCount < 3) && (
        <p className="text-xs text-neutral-500">
          {stoppedForTie ? "A tie means only clear leaders are highlighted." : "Fewer than three places have votes yet."}
        </p>
      )}

      {/* Summary removed per request; controls remain in the nearby radius box below */}
      {/* Location prompt / radius controls (similar to nightlife) */}
      <div className="mb-4">
        {!loc ? (
          <div className="rounded-md p-3 bg-neutral-900 border border-neutral-800 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Show nearby places</div>
              <div className="text-neutral-400 text-xs">Allow location to see the {topN} closest popular places near you.</div>
            </div>
            <div>
              <button onClick={() => { try { requestLocation(); } catch {} }} className="px-3 py-1 rounded-md bg-yellow-400 text-black">Allow location</button>
              <div className="mt-2 text-sm">
                <label className="text-neutral-400 text-xs mr-2">Or pick your city</label>
                <select value={userCity ?? ""} onChange={(e) => setUserCity(e.target.value || null)} className="bg-neutral-900 border border-neutral-800 p-2 rounded">
                  <option value="">-- select city --</option>
                  {Array.from(new Set(FOOD_VENUES.map((v) => v.city))).sort().map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md p-3 bg-neutral-900 border border-neutral-800 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">Nearby radius</div>
              <div className="text-neutral-400 text-xs">Showing places within your selected range.</div>
            </div>
            <div className="flex items-center gap-2">
              {([5, 10, 25, 50, 100] as number[]).map((rKm) => {
                const rMiles = Math.round(rKm * 0.621371);
                return (
                  <button key={rKm} onClick={() => setRadiusMiles(rMiles)} className={`px-2 py-1 rounded ${radiusMiles === rMiles ? 'bg-yellow-400 text-black' : 'bg-neutral-800'}`}>
                    {rMiles}mi
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loc && (
          <div className="text-sm text-neutral-400">
          Showing <span className="font-medium">{filteredVenues.length}</span> {filteredVenues.length === 1 ? 'place' : 'places'} within <span className="font-medium">{radiusMiles}mi</span>
        </div>
      )}

      <div className="grid gap-4">
        {topVenues.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-400">
            No nearby food places found within {radiusMiles} mi. Try increasing the radius or <Link href="/food">browse all</Link>.
            <div className="mt-2">
              <button onClick={() => setRadiusMiles(Math.round(100 * 0.621371))} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">Expand to {Math.round(100 * 0.621371)} mi</button>
            </div>
          </div>
        ) : (
          topVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              id={venue.id}
              name={venue.name}
              voters={tallies[venue.id]?.voters || 0}
              heatScore={heatScores[venue.id] || 0}
              price={tallies[venue.id]?.price ?? null}
              lat={venue.lat}
              lng={venue.lng}
              foodMode
              foodMeta={{ avgPrice: (foodPredItems[venue.id]?.avgPrice ?? tallies[venue.id]?.price) ?? undefined, popularDays: [] }}
              reportReasons={[
                { key: 'food_poisoning', label: 'Food poisoning' },
                { key: 'wrong_order', label: 'Wrong order' },
                { key: 'poor_delivery', label: 'Poor delivery' },
                { key: 'other', label: 'Other' },
              ]}
            />
          ))
        )}
      </div>
    </div>
  );
}
