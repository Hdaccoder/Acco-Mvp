// src/app/vote/VoteClient.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureAnon } from "@/lib/auth";
import { VENUES } from "@/lib/venues";
import { nightKey } from "@/lib/dates";
import { useUserLocation } from "@/hooks/useUserLocation";

const WINDOWS = ["20-21", "21-22", "22-23", "23-24"] as const;

type Props = { initialVenue: string | null };

export default function VoteClient({ initialVenue }: Props) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [intent, setIntent] = useState<"yes" | "maybe" | "no">("yes");
  const [selected, setSelected] = useState<string[]>([]);
  const [windowSel, setWindowSel] = useState<string>(WINDOWS[1]);
  const { loc, error: locError } = useUserLocation();
  const [err, setErr] = useState<string | null>(null);

  // sign in anonymously
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

  // preselect via ?venue=... from the server page
  useEffect(() => {
    if (!initialVenue) return;
    if (!VENUES.some((v) => v.id === initialVenue)) return;
    setIntent((prev) => (prev === "no" ? "yes" : prev));
    setSelected((prev) =>
      prev.includes(initialVenue) ? prev : [...prev, initialVenue]
    );
  }, [initialVenue]);

  const canSubmit = Boolean(uid && (intent === "no" || selected.length > 0) && db);

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

      // “No” vote — counts towards stay-in signal
      if (intent === "no") {
        await setDoc(
          doc(db, "nights", nk, "votes", uid),
          {
            userId: uid,
            intent,
            selections: [],
            location: null,
            lastEditedAt: new Date(),
          },
          { merge: true }
        );
        router.push("/");              // ⬅️ redirect to home
        return;
      }

      if (selected.length === 0) {
        setErr("Pick at least one venue.");
        return;
      }

      await setDoc(
        doc(db, "nights", nk, "votes", uid),
        {
          userId: uid,
          intent,
          selections: selected.map((id) => ({
            venueId: id,
            arrivalWindow: windowSel,
            updatedAt: new Date(),
          })),
          location: loc
            ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? null }
            : null,
          lastEditedAt: new Date(),
        },
        { merge: true }
      );

      router.push("/");                // ⬅️ redirect to home
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Vote for tonight</h1>

      <p className="text-sm text-neutral-400">
        Each account can submit <span className="font-medium">one vote</span> per
        night. You can update it anytime — we keep your latest choice.
      </p>

      {err && (
        <p className="text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-3">
          {err}
        </p>
      )}

      <div className="space-y-2">
        <label className="text-sm text-neutral-300">Are you going out tonight?</label>
        <div className="flex gap-2">
          {(["yes", "maybe", "no"] as const).map((x) => (
            <button
              key={x}
              onClick={() => setIntent(x)}
              className={`px-3 py-2 rounded-xl border ${
                intent === x ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-800"
              }`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      {intent === "no" && (
        <p className="text-sm text-neutral-400">
          Not going out tonight? Submit to count towards the stay-in signal.
        </p>
      )}

      {intent !== "no" && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Where are you likely to go?</label>
            <div className="grid gap-2">
              {VENUES.map((v) => (
                <label
                  key={v.id}
                  className={`flex items-center gap-2 p-3 rounded-xl border ${
                    selected.includes(v.id)
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-neutral-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(v.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, v.id] : prev.filter((i) => i !== v.id)
                      )
                    }
                  />
                  <span>{v.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neutral-300">Arrival window</label>
            <div className="flex gap-2">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowSel(w)}
                  className={`px-3 py-2 rounded-xl border ${
                    w === windowSel ? "border-yellow-400 bg-yellow-400/10" : "border-neutral-800"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="px-4 py-2 rounded-xl bg-yellow-400 text-black disabled:opacity-50"
      >
        Submit
      </button>

      {locError && (
        <p className="text-xs text-red-400">Location error: {locError} (You can still vote)</p>
      )}
    </div>
  );
}
