"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getIdTokenSafe } from "@/lib/firebase";
import { ensureAnon } from "@/lib/auth";
import { VENUES } from "@/lib/venues";
import { FOOD_VENUES } from "@/lib/food_venues";
import { nightKey } from "@/lib/dates";
import { useUserLocation } from "@/hooks/useUserLocation";

const WINDOWS = ["18-19", "19-20", "20-21", "21-22", "22-23", "23-24", "00-01", "01-02"] as const;
type Intent = "yes" | "maybe" | "no";
type Props = { initialVenue?: string | null; foodMode?: boolean };

const INTENT_OPTIONS: { value: Intent; label: string; description: string }[] = [
  { value: "yes", label: "Yes", description: "I am heading out" },
  { value: "maybe", label: "Maybe", description: "Still deciding" },
  { value: "no", label: "Staying in", description: "No plans tonight" },
];

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitude = radians(b.lat - a.lat);
  const longitude = radians(b.lng - a.lng);
  const h = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export default function VoteClient({ initialVenue = null, foodMode = false }: Props) {
  const router = useRouter();
  const venueList = foodMode ? FOOD_VENUES : VENUES;
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authRetry, setAuthRetry] = useState(0);
  const [intent, setIntent] = useState<Intent>("yes");
  const [selected, setSelected] = useState<string[]>([]);
  const [arrivalWindow, setArrivalWindow] = useState<string>(WINDOWS[2]);
  const [price, setPrice] = useState(25);
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loc, error: locationError, requestLocation } = useUserLocation();

  const cities = useMemo(() => Array.from(new Set(venueList.map((venue) => venue.city).filter((value): value is string => Boolean(value)))).sort(), [venueList]);
  const visibleVenues = useMemo(() => city ? venueList.filter((venue) => venue.city === city) : [], [city, venueList]);

  useEffect(() => {
    let active = true;
    setAuthReady(false);
    setAuthError(null);
    void (async () => {
      try {
        const uid = await ensureAnon();
        if (!uid) throw new Error("No anonymous user returned.");
        if (active) setAuthReady(true);
      } catch {
        if (active) setAuthError("Unable to start a private voting session. Check your connection and try again.");
      }
    })();
    return () => { active = false; };
  }, [authRetry]);

  useEffect(() => {
    if (!initialVenue) return;
    const venue = venueList.find((item) => item.id === initialVenue);
    if (!venue) return;
    setSelected([venue.id]);
    setCity(venue.city || "");
  }, [initialVenue, venueList]);

  useEffect(() => {
    if (!loc || city || selected.length) return;
    const nearest = venueList
      .map((venue) => ({ venue, distance: distanceMeters(loc, venue) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest?.venue.city && nearest.distance < 100_000) setCity(nearest.venue.city);
  }, [city, loc, selected.length, venueList]);

  const canSubmit = authReady && !submitting && (foodMode
    ? selected.length === 1
    : intent === "no" ? Boolean(city) : selected.length > 0 && selected.length <= 8);
  const selectionLimitReached = !foodMode && selected.length >= 8;

  const toggleVenue = (id: string, checked: boolean) => {
    if (foodMode) {
      setSelected(checked ? [id] : []);
      return;
    }
    setSelected((current) => {
      if (!checked) return current.filter((item) => item !== id);
      if (current.includes(id) || current.length >= 8) return current;
      return [...current, id];
    });
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await ensureAnon();
      const token = await getIdTokenSafe();
      if (!token) throw new Error("A secure voting session could not be started. Please try again.");
      const selections = foodMode
        ? [{ venueId: selected[0], price }]
        : intent === "no"
          ? []
          : selected.map((venueId) => ({ venueId, arrivalWindow }));
      const response = await fetch("/api/vote/submit", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: foodMode ? "food" : "nightlife",
          nightKey: nightKey(),
          vote: {
            intent: foodMode ? "yes" : intent,
            selections,
            location: intent === "no" ? null : loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null } : null,
            city: city || null,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The vote could not be saved.");
      router.push(foodMode ? "/food" : "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The vote could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-5 pb-6">
      <header className="min-w-0 overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="rounded-full bg-yellow-400/10 px-3 py-1 text-sm font-semibold text-yellow-300">Community vote</p>
          <span className="text-xs text-neutral-400">Takes less than a minute</span>
        </div>
        <h1 className="mt-4 max-w-full break-words text-3xl font-bold tracking-tight sm:text-4xl">{foodMode ? "Where are you eating tonight?" : "What are your plans tonight?"}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-300">Your latest vote replaces any earlier vote tonight. Location is optional and stored only at reduced precision.</p>
      </header>

      {!authReady && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-sm text-neutral-300" aria-live="polite" role={authError ? "alert" : undefined}>
          <p>{authError || "Preparing a private voting session…"}</p>
          {authError && <button type="button" onClick={() => setAuthRetry((value) => value + 1)} className="min-h-11 rounded-xl border border-neutral-700 px-3 font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800">Try again</button>}
        </div>
      )}
      {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{error}</p>}

      {!foodMode && (
        <fieldset className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm sm:p-5">
          <legend className="sr-only">Are you going out?</legend>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">1 · Tonight</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Are you going out?</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-400">A quick answer helps make the local signal more useful.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {INTENT_OPTIONS.map((option) => {
              const isSelected = intent === option.value;
              return (
                <label key={option.value} className={`flex min-h-[76px] items-center gap-3 rounded-2xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-yellow-300 focus-within:ring-offset-2 focus-within:ring-offset-neutral-950 ${isSelected ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(250,204,21,0.18)]" : "cursor-pointer border-neutral-800 bg-neutral-950/60 hover:border-neutral-600 hover:bg-neutral-900"}`}>
                  <input className="sr-only" type="radio" name="intent" value={option.value} checked={isSelected} onChange={() => { setIntent(option.value); if (option.value === "no") setSelected([]); }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-neutral-400">{option.description}</span>
                  </span>
                  <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm font-bold ${isSelected ? "border-yellow-300 bg-yellow-300 text-black" : "border-neutral-600 bg-neutral-900 text-transparent"}`}>✓</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <section aria-labelledby="city-heading" className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">{foodMode ? "1" : "2"} · Your area</p>
            <h2 id="city-heading" className="mt-1 text-lg font-semibold">Choose your town or city</h2>
          </div>
          {city && <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">Area selected</span>}
        </div>
        <label htmlFor="vote-city" className="mt-4 block text-sm font-medium text-neutral-200">Your town or city</label>
        <select id="vote-city" value={city} onChange={(event) => { setCity(event.target.value); setSelected([]); }} className="mt-2 min-h-12 w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 text-base shadow-inner transition hover:border-neutral-500 focus:border-yellow-300">
          <option value="">Choose an area</option>
          {cities.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <p className="mt-2 text-xs leading-5 text-neutral-400">We only show places in the area you choose.</p>
      </section>

      {(foodMode || intent !== "no") && (
        <fieldset className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm sm:p-5">
          <legend className="sr-only">{foodMode ? "Choose one food place" : "Where are you likely to go?"}</legend>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">{foodMode ? "2" : "3"} · Pick places</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{foodMode ? "Choose one food place" : "Where are you likely to go?"}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-neutral-400">{foodMode ? "Choose the place you are most likely to visit." : "Choose up to eight places you may visit."}</p>
            <p aria-live="polite" className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-neutral-300">{foodMode ? (selected.length ? "1 of 1 selected" : "Choose 1 place") : `${selected.length} of 8 selected`}</p>
          </div>
          {!city && <p className="mt-4 rounded-2xl border border-dashed border-neutral-700 bg-neutral-950/60 p-4 text-sm text-neutral-400">Choose a town or city above to see the local places.</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {visibleVenues.map((venue) => {
              const isSelected = selected.includes(venue.id);
              const isDisabled = selectionLimitReached && !isSelected;
              return (
                <label key={venue.id} className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-yellow-300 focus-within:ring-offset-2 focus-within:ring-offset-neutral-950 ${isSelected ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_0_1px_rgba(250,204,21,0.18)]" : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-600 hover:bg-neutral-900"} ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                  <input className="sr-only" type={foodMode ? "radio" : "checkbox"} name={foodMode ? "food-venue" : undefined} checked={isSelected} disabled={isDisabled} onChange={(event) => toggleVenue(venue.id, event.target.checked)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{venue.name}</span>
                    <span className="mt-0.5 block text-xs text-neutral-400">{isSelected ? "Selected" : foodMode ? "Choose this place" : isDisabled ? "Selection limit reached" : "Tap to add"}</span>
                  </span>
                  <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center ${foodMode ? "rounded-full" : "rounded-lg"} border text-sm font-bold ${isSelected ? "border-yellow-300 bg-yellow-300 text-black" : "border-neutral-600 bg-neutral-900 text-transparent"}`}>✓</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {!foodMode && intent !== "no" && (
        <fieldset className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm sm:p-5">
          <legend className="sr-only">Expected arrival time</legend>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">4 · Timing</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Expected arrival time</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-400">Choose the one-hour window that is most likely. Local time.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WINDOWS.map((window) => {
              const isSelected = arrivalWindow === window;
              return (
                <label key={window} className={`flex min-h-12 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-yellow-300 focus-within:ring-offset-2 focus-within:ring-offset-neutral-950 ${isSelected ? "border-yellow-400 bg-yellow-400/10 text-white" : "cursor-pointer border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900"}`}>
                  <input className="sr-only" type="radio" name="arrival" value={window} checked={isSelected} onChange={() => setArrivalWindow(window)} />
                  <span>{window.replace("-", "–")}</span>
                  <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border text-xs font-bold ${isSelected ? "border-yellow-300 bg-yellow-300 text-black" : "border-neutral-600 text-transparent"}`}>✓</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {foodMode && (
        <section aria-labelledby="spend-heading" className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300">3 · Budget</p>
              <h2 id="spend-heading" className="mt-1 text-lg font-semibold">Expected spend</h2>
            </div>
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-sm font-bold text-black">£{price}</span>
          </div>
          <label htmlFor="expected-spend" className="sr-only">Expected spend: £{price}</label>
          <input id="expected-spend" className="mt-5 w-full accent-yellow-400" type="range" min="5" max="150" step="5" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
          <div className="mt-1 flex justify-between text-xs text-neutral-400"><span>£5</span><span>£150</span></div>
        </section>
      )}

      <section aria-labelledby="location-heading" className="rounded-3xl border border-neutral-800 bg-neutral-900/40 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Optional</p>
            <h2 id="location-heading" className="mt-1 text-lg font-semibold">Add approximate location</h2>
          </div>
          {loc && <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">Location added</span>}
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-400">This helps distinguish local votes. The server rounds coordinates to roughly a one-kilometre area before saving.</p>
        <button type="button" onClick={() => requestLocation()} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-neutral-700 px-4 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800">{loc ? "Update approximate location" : "Share approximate location"}</button>
        {loc && <p className="mt-3 text-xs text-emerald-200" role="status">Approximate location added.</p>}
        {locationError && <p className="mt-3 text-xs text-amber-200" role="alert">{locationError} You can still vote without it.</p>}
      </section>

      <section className="space-y-3">
        <p className="text-center text-xs text-neutral-400" aria-live="polite">
          {!authReady ? "Setting up your private voting session…" : foodMode ? (selected.length === 1 ? "Ready to submit your food vote." : "Choose one place to continue.") : intent === "no" ? (city ? "Ready to submit your vote." : "Choose your area to continue.") : (selected.length ? "Ready to submit your vote." : "Choose at least one place to continue.")}
        </p>
        <button type="button" onClick={submit} disabled={!canSubmit} className="min-h-14 w-full rounded-2xl bg-yellow-400 px-5 py-3 font-semibold text-black shadow-lg shadow-yellow-400/10 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? "Saving vote…" : "Submit vote"}
        </button>
      </section>
    </div>
  );
}
