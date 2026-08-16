"use client";

import NextDynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePopularityData } from "@/hooks/usePopularityData";
import { formatUpdatedAt, statusFromSignals, type Confidence } from "@/lib/popularity";
import VenueCard from "@/components/VenueCard";

const MapView = NextDynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-neutral-900" aria-label="Loading map" />,
});

type Mode = "nightlife" | "food";
type Venue = { id: string; name: string; lat: number; lng: number; baseline?: number; city?: string };
type Props = { mode: Mode; venues: Venue[] };

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitude = radians(b.lat - a.lat);
  const longitude = radians(b.lng - a.lng);
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export default function PopularityExplorer({ mode, venues }: Props) {
  const foodMode = mode === "food";
  const data = usePopularityData(mode);
  const [city, setCity] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");

  const storagePrefix = foodMode ? "food" : "nightlife";
  useEffect(() => {
    try {
      setCity(localStorage.getItem(`${storagePrefix}City`) || "");
      const savedRadius = Number(localStorage.getItem(`${storagePrefix}RadiusMiles`));
      if (Number.isFinite(savedRadius) && savedRadius > 0) setRadiusMiles(savedRadius);
    } catch {}
  }, [storagePrefix]);

  useEffect(() => {
    try {
      localStorage.setItem(`${storagePrefix}City`, city);
      localStorage.setItem(`${storagePrefix}RadiusMiles`, String(radiusMiles));
    } catch {}
  }, [city, radiusMiles, storagePrefix]);

  const cities = useMemo(() => Array.from(new Set(venues.map((venue) => venue.city).filter((value): value is string => Boolean(value)))).sort(), [venues]);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("Location is not supported by this browser. Choose a town instead.");
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setCity("");
      },
      () => setLocationError("We could not access your location. Choose a town or try again."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const radiusMeters = radiusMiles * 1609.34;
    const scopedVenues = venues
      .map((venue) => ({
        ...venue,
        distance: location ? distanceMeters(location, venue) : null,
        tally: data.tallies[venue.id],
        prediction: data.predictions[venue.id],
      }))
      .filter((venue) => !location || (venue.distance != null && venue.distance <= radiusMeters))
      .filter((venue) => !city || venue.city === city);
    const withSignals = scopedVenues.map((venue) => {
      const voters = venue.tally?.voters || 0;
      const forecastIndex = venue.tally?.forecastIndex || venue.prediction?.score || 0;
      const liveAverage = voters ? (venue.tally?.weighted || 0) / voters : 0;
      const reliability = voters / (voters + 5);
      return { ...venue, localSignal: reliability * liveAverage + (1 - reliability) * (forecastIndex / 100) };
    });
    const maxSignal = Math.max(0.01, ...withSignals.map((venue) => venue.localSignal));

    return withSignals
      .map((venue) => {
        if (!venue.tally) return venue;
        const index = Math.round((venue.localSignal / maxSignal) * 100);
        return {
          ...venue,
          tally: {
            ...venue.tally,
            index,
            status: statusFromSignals(venue.tally.voters, index, venue.tally.forecastIndex, venue.tally.trend),
          },
        };
      })
      .filter((venue) => !normalizedQuery || `${venue.name} ${venue.city || ""}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const byIndex = (b.tally?.index || b.prediction?.score || 0) - (a.tally?.index || a.prediction?.score || 0);
        if (byIndex) return byIndex;
        const byVotes = (b.tally?.voters || 0) - (a.tally?.voters || 0);
        if (byVotes) return byVotes;
        return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER);
      });
  }, [city, data.predictions, data.tallies, location, query, radiusMiles, venues]);

  const ranks = useMemo(() => {
    if (data.totalParticipants < 3) return {};
    return Object.fromEntries(results.slice(0, 3).map((venue, index) => [venue.id, (index + 1) as 1 | 2 | 3]));
  }, [data.totalParticipants, results]);

  const mapTallies = useMemo(() => Object.fromEntries(results.map((venue) => [venue.id, {
    voters: venue.tally?.voters || 0,
    weighted: venue.tally?.index || venue.prediction?.score || 0,
    price: venue.tally?.price ?? null,
  }])), [results]);

  const totalSentiment = data.sentiment.yesMaybe + data.sentiment.no;
  const stayingIn = totalSentiment ? Math.round((data.sentiment.no / totalSentiment) * 100) : null;
  const areaLabel = location ? `within ${radiusMiles} miles` : city || "across all listed areas";
  const comparisonLabel = location ? `places within ${radiusMiles} miles` : city ? `places in ${city}` : "all listed places";
  const voteHref = foodMode ? "/food/vote" : "/vote";

  return (
    <div className="space-y-6">
      <section aria-labelledby="popular-heading" className="space-y-3">
        <p className="text-sm font-medium text-yellow-300">Live local guide</p>
        <h1 id="popular-heading" className="text-3xl font-bold tracking-tight text-white">
          What&apos;s popular {location ? "near you" : city ? `in ${city}` : "tonight"}?
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-300">
          Live community votes are blended with historical patterns when the sample is small. Scores compare places in the area you choose; they are popularity indexes, not probabilities.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400" aria-live="polite">
          <span>{formatUpdatedAt(data.generatedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{data.totalParticipants} total {data.totalParticipants === 1 ? "participant" : "participants"} across Acco</span>
          {data.refreshing && <span>Refreshing…</span>}
          <button type="button" onClick={data.refresh} className="underline decoration-neutral-600 underline-offset-4 hover:text-white">Refresh</button>
        </div>
      </section>

      {data.error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {data.error} <button type="button" onClick={data.refresh} className="ml-1 underline">Try again</button>
        </div>
      )}

      <section aria-labelledby="area-heading" className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 id="area-heading" className="font-semibold text-white">Choose your area</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${mode}-city`} className="mb-1 block text-sm text-neutral-300">Town or city</label>
            <select id={`${mode}-city`} value={city} onChange={(event) => { setCity(event.target.value); setLocation(null); }} className="min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2">
              <option value="">All listed areas</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${mode}-search`} className="mb-1 block text-sm text-neutral-300">Search places</label>
            <input id={`${mode}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Venue or area name" className="min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={requestLocation} className="min-h-11 rounded-lg bg-yellow-400 px-3 text-sm font-semibold text-black hover:bg-yellow-300">
            {location ? "Update my location" : "Use my location"}
          </button>
          {location && <button type="button" onClick={() => setLocation(null)} className="min-h-11 rounded-lg border border-neutral-700 px-3 text-sm hover:bg-neutral-800">Stop using location</button>}
          {location && (
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              Radius
              <select value={radiusMiles} onChange={(event) => setRadiusMiles(Number(event.target.value))} className="min-h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-2">
                {[3, 5, 10, 25, 50].map((radius) => <option key={radius} value={radius}>{radius} mi</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="mt-3 text-xs leading-5 text-neutral-400">Coverage currently includes {cities.length} listed towns and cities. Results only include places Acco has added so far.</p>
        {locationError && <p className="mt-2 text-sm text-amber-200" role="alert">{locationError}</p>}
      </section>

      <section aria-labelledby="results-heading">
        <div className="mobile-results-header mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-heading" className="text-xl font-semibold text-white">Popular {areaLabel}</h2>
            <p className="mt-1 text-sm text-neutral-400">{results.length} {results.length === 1 ? "place" : "places"} found{stayingIn != null ? ` · ${stayingIn}% of today's respondents are staying in` : ""}</p>
          </div>
          <div className="mobile-results-toggle inline-flex rounded-lg border border-neutral-700 p-1" aria-label="Results view">
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`min-h-11 rounded-md px-3 text-sm ${view === "list" ? "bg-white text-black" : "text-neutral-300"}`}>List</button>
            <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={`min-h-11 rounded-md px-3 text-sm ${view === "map" ? "bg-white text-black" : "text-neutral-300"}`}>Map</button>
          </div>
        </div>

        {data.loading ? (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <p className="sr-only">Loading local popularity</p>
            {[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-neutral-900 motion-reduce:animate-none" />)}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 p-6 text-sm text-neutral-300">
            No matching places were found. Clear the search, choose another town, or increase the radius. This area may not be in Acco&apos;s current venue coverage yet.
          </div>
        ) : view === "map" ? (
          <div>
            <p id={`${mode}-map-help`} className="mb-2 text-xs text-neutral-400">The ranked list is available by selecting List. Map colours are also described in marker labels.</p>
            <MapView ranks={ranks} venues={results} tallies={mapTallies} userLoc={location} foodMode={foodMode} reports={data.reports} />
          </div>
        ) : (
          <div className="grid gap-4">
            {results.map((venue, index) => {
              const tally = venue.tally;
              const prediction = venue.prediction;
              const arrival = data.arrivalCounts[venue.id] || {};
              const popularTimes = Object.entries(arrival).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([time]) => time);
              const confidence: Confidence = tally?.voters && tally.voters >= 3 ? tally.confidence : prediction?.confidence || tally?.confidence || "low";
              return (
                <VenueCard
                  key={venue.id}
                  id={venue.id}
                  name={venue.name}
                  rank={index + 1}
                  voters={tally?.voters || 0}
                  heatScore={tally?.index || prediction?.score || 0}
                  forecastIndex={prediction?.score || tally?.forecastIndex || 0}
                  confidence={confidence}
                  status={tally?.status || "early"}
                  trend={prediction?.trend || tally?.trend || "steady"}
                  peakToday={popularTimes[0] || prediction?.typicalPeak || null}
                  price={tally?.price ?? prediction?.avgPrice ?? null}
                  lat={venue.lat}
                  lng={venue.lng}
                  distanceMiles={venue.distance == null ? null : venue.distance / 1609.34}
                  reports={data.reports[venue.id]}
                  foodMode={foodMode}
                  foodMeta={{ avgPrice: prediction?.avgPrice ?? tally?.price ?? undefined, popularDays: [] }}
                  nightMeta={{ popularDay: prediction?.typicalPeak || undefined, popularTimes }}
                  reportReasons={foodMode ? [
                    { key: "food_poisoning", label: "Food poisoning" },
                    { key: "wrong_order", label: "Wrong order" },
                    { key: "poor_delivery", label: "Poor delivery" },
                    { key: "other", label: "Other" },
                  ] : undefined}
                  comparisonLabel={comparisonLabel}
                />
              );
            })}
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm text-neutral-300">
        <h2 className="font-semibold text-white">Help improve the local picture</h2>
        <p className="mt-1">More votes make live rankings and future forecasts more reliable.</p>
        <Link href={voteHref} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-yellow-400 px-4 font-semibold text-black hover:bg-yellow-300">Cast your vote</Link>
      </aside>
    </div>
  );
}
