"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db, getClientDb, getIdTokenSafe } from "@/lib/firebase";
import { ensureAnon } from "@/lib/auth";
import { VENUES } from "@/lib/venues";
import { FOOD_VENUES } from "@/lib/food_venues";
import { nightKey } from "@/lib/dates";
import { useUserLocation } from "@/hooks/useUserLocation";

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

const WINDOWS = [
  "18-19",
  "19-20",
  "20-21",
  "21-22",
  "22-23",
  "23-24",
  "00-01",
  "01-02",
] as const;

type Props = { initialVenue?: string | null; foodMode?: boolean };

export default function VoteClient({ initialVenue = null, foodMode = false }: Props) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [intent, setIntent] = useState<"yes" | "maybe" | "no">("yes");
  const [selected, setSelected] = useState<string[]>([]);
  const [windowSel, setWindowSel] = useState<string>(WINDOWS[2]);
  const [priceSel, setPriceSel] = useState<number>(50);
  const { loc, error: locError } = useUserLocation();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const VENUE_LIST = foodMode ? FOOD_VENUES : VENUES;

  useEffect(() => {
    let active = true;
    (async () => {
      const id = await ensureAnon();
      if (!active) return;
      setUid(id);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialVenue) return;
    if (!VENUE_LIST.some((v) => v.id === initialVenue)) return;
    setSelected((prev) => (prev.includes(initialVenue) ? prev : [...prev, initialVenue]));
    const iv = VENUE_LIST.find((v) => v.id === initialVenue);
    if (iv && iv.city) setSelectedCity(iv.city);
  }, [initialVenue, foodMode]);

  useEffect(() => {
    if (!loc) return;
    let nearest: { city?: string; dist: number } | null = null;
    for (const v of VENUE_LIST) {
      const d = haversineMeters(loc, { lat: v.lat, lng: v.lng });
      if (!nearest || d < nearest.dist) nearest = { city: v.city, dist: d };
    }
    if (nearest && nearest.city && nearest.dist < 100000) setSelectedCity(nearest.city);
  }, [loc, foodMode]);

  const canSubmit = Boolean(
    uid && (
      (!foodMode && ((intent === "no" && selectedCity) || (intent !== "no" && selected.length > 0))) ||
      (foodMode && selected.length > 0 && priceSel > 0)
    )
  );

  async function submit() {
    setErr(null);
    if (!uid) {
      setErr("You’re not signed in yet. Please wait and try again.");
      return;
    }
    if (!db) {
      setErr("Database not initialised (check .env on the server).");
      return;
    }

    try {
      const nk = nightKey();
      const baseNights = foodMode ? "food_nights" : "nights";

      // Use server endpoint to submit votes via Admin SDK (avoids client rules issues)
      const idToken = await getIdTokenSafe();
      if (!idToken) {
        setErr('Unable to acquire auth token. Please try again.');
        return;
      }

      // Build vote payload according to mode
      if (foodMode) {
        if (selected.length === 0) {
          setErr("Pick a venue to eat at tonight.");
          return;
        }
        const venueId = selected[0];
        const price = priceSel;

        const votePayload = {
          intent: 'yes',
          selections: [ { venueId, price, updatedAt: new Date().toISOString() } ],
          location: loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null } : null,
          city: selectedCity ?? null,
          createdAt: new Date().toISOString(),
        };

        const res = await fetch('/api/vote/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken, baseNights, nightKey: nk, vote: votePayload }),
        });
        const body = await res.json();
        if (!res.ok || !body?.ok) {
          setErr(body?.error || 'Server rejected vote');
          return;
        }

        router.push('/food');
        return;
      }

      if (intent === "no") {
        if (!selectedCity) {
          setErr("Please select your city before submitting a 'No' vote.");
          return;
        }
        const votePayload = {
          intent,
          selections: [ { venueId: selectedCity ?? 'none' } ],
          location: null,
          city: selectedCity ?? null,
          createdAt: new Date().toISOString(),
        };
        const idToken2 = await getIdTokenSafe();
        const res = await fetch('/api/vote/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken: idToken2, baseNights, nightKey: nk, vote: votePayload }),
        });
        const body = await res.json();
        if (!res.ok || !body?.ok) { setErr(body?.error || 'Server rejected vote'); return; }
        router.push('/');
        return;
      }

      if (selected.length === 0) {
        setErr("Pick at least one venue.");
        return;
      }

      // intent !== 'no' branch: standard out-going votes
      const votePayload = {
        intent,
        selections: selected.map((id) => ({ venueId: id, arrivalWindow: windowSel, updatedAt: new Date().toISOString() })),
        location: loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null } : null,
        createdAt: new Date().toISOString(),
      };
      const idToken3 = await getIdTokenSafe();
      const res2 = await fetch('/api/vote/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: idToken3, baseNights, nightKey: nk, vote: votePayload }),
      });
      const b2 = await res2.json();
      if (!res2.ok || !b2?.ok) { setErr(b2?.error || 'Server rejected vote'); return; }

      router.push('/');
    } catch (e: any) {
      console.error('submit vote error', e);
      setErr(e?.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{foodMode ? "Where are you eating tonight?" : "Vote for tonight"}</h1>

      <p className="text-sm text-neutral-400">
        {foodMode ? (
          <>Pick a food place in your city and optionally indicate a rough price.</>
        ) : (
          <>Each account can submit <span className="font-medium">one vote</span> per night. You can update it anytime — we keep your latest choice.</>
        )}
      </p>

      {err && <p className="text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3">{err}</p>}

      {foodMode ? (
        <>
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Choose a city</label>
            <div className="flex items-center gap-2">
              <select value={selectedCity ?? ""} onChange={(e) => setSelectedCity(e.target.value || null)} className="bg-neutral-900 border border-neutral-800 p-2 rounded">
                <option value="">-- select city --</option>
                {Array.from(new Set(VENUE_LIST.map((v) => v.city))).sort().map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Which place are you going to eat at?</label>
            <div className="grid gap-2">
              {(selectedCity ? VENUE_LIST.filter((v) => v.city === selectedCity) : []).map((v) => (
                <label key={v.id} className={`flex items-center gap-2 p-3 rounded-xl border ${selected.includes(v.id) ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-800"}`}>
                  <input type="radio" name="food-select" checked={selected.includes(v.id)} onChange={() => setSelected([v.id])} />
                  <span>{v.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Rough price (£1 — £100)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={100}
                value={priceSel}
                onChange={(e) => setPriceSel(Number(e.target.value))}
                className="w-full"
              />
              <div className="w-24 text-sm text-neutral-300">£{priceSel}</div>
            </div>
          </div>

          <button onClick={submit} disabled={!canSubmit} className="px-4 py-2 rounded-xl bg-yellow-400 text-black disabled:opacity-50">Submit</button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Are you going out tonight?</label>
            <div className="flex flex-wrap gap-2">
              {["yes", "maybe", "no"].map((x) => (
                <button key={x} onClick={() => setIntent(x as any)} className={`px-3 py-2 rounded-xl border ${intent === x ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-800"}`}>
                  {x}
                </button>
              ))}
            </div>
          </div>

          {intent === "no" && (
            <>
              <p className="text-sm text-neutral-400">Not going out tonight? Submit to count towards the stay-in signal.</p>

              <div className="mt-2">
                <label className="text-sm text-neutral-300">Your city</label>
                <div className="flex items-center gap-2 mt-1">
                  <select value={selectedCity ?? ""} onChange={(e) => setSelectedCity(e.target.value || null)} className="bg-neutral-900 border border-neutral-800 p-2 rounded">
                    <option value="">-- select city --</option>
                    {Array.from(new Set(VENUE_LIST.map((v) => v.city))).sort().map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {selectedCity && (<div className="text-sm text-neutral-400">Selected: <span className="font-medium text-neutral-200">{selectedCity}</span></div>)}
                </div>
              </div>
            </>
          )}

          {intent !== "no" && (
            <>
              <div className="space-y-2">
                <label className="text-sm text-neutral-300">Where are you likely to go?</label>

                {!selectedCity && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Choose a city:</label>
                    <select value={selectedCity ?? ""} onChange={(e) => setSelectedCity(e.target.value || null)} className="bg-neutral-900 border border-neutral-800 p-2 rounded">
                      <option value="">-- select city --</option>
                      {Array.from(new Set(VENUE_LIST.map((v) => v.city))).sort().map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid gap-2">
                  {(selectedCity ? VENUE_LIST.filter((v) => v.city === selectedCity) : []).map((v) => (
                    <label key={v.id} className={`flex items-center gap-2 p-3 rounded-xl border ${selected.includes(v.id) ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-800"}`}>
                      <input type="checkbox" checked={selected.includes(v.id)} onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, v.id] : prev.filter((i) => i !== v.id)))} />
                      <span>{v.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-300">Arrival window</label>
                <div className="flex flex-wrap gap-2">
                  {WINDOWS.map((w) => (
                    <button key={w} onClick={() => setWindowSel(w)} className={`px-3 py-2 rounded-xl border ${w === windowSel ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-800"}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={submit} disabled={!canSubmit} className="px-4 py-2 rounded-xl bg-yellow-400 text-black disabled:opacity-50">Submit</button>

          {locError && (<p className="text-xs text-red-400">Location error: {locError} (You can still vote)</p>)}
        </>
      )}
    </div>
  );
}
