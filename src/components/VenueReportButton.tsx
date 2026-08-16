"use client";

import { useEffect, useId, useState } from "react";
import { auth } from "@/lib/firebase";
import { ensureAnon } from "@/lib/auth";

type Reason = { key: string; label: string };

export default function VenueReportButton({ id, reasons }: { id: string; reasons?: Reason[] }) {
  const titleId = useId();
  const descriptionId = useId();
  const availableReasons = reasons || [
    { key: "spiking", label: "Suspected drink spiking" },
    { key: "fight", label: "Fight or violence" },
    { key: "bouncers", label: "Staff or door issue" },
    { key: "other", label: "Other safety concern" },
  ];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(availableReasons[0].key);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await ensureAnon();
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error("Could not start a secure report session.");
      const response = await fetch("/api/venue/report", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId: id, reason }),
      });
      if (!response.ok) throw new Error("Unable to send the report. Please try again.");
      setDone(true);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={done} aria-haspopup="dialog" className="min-h-11 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-70">
        {done ? "Reported" : "Report safety issue"}
      </button>
      {error && <span className="self-center text-xs text-red-200" role="alert">{error}</span>}

      {open && (
        <div className="fixed inset-0 z-[9999] grid place-items-start overflow-y-auto bg-black/75 p-4 sm:place-items-center" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-5 shadow-2xl">
            <h2 id={titleId} className="text-lg font-semibold">Report a safety concern</h2>
            <p id={descriptionId} className="mt-1 text-sm text-neutral-400">Reports help warn the community. For an emergency, contact local emergency services.</p>
            <fieldset className="mt-4 space-y-2">
              <legend className="mb-2 text-sm font-medium">What happened?</legend>
              {availableReasons.map((item) => (
                <label key={item.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 p-3 hover:bg-neutral-900">
                  <input type="radio" name={`report-${id}`} value={item.key} checked={reason === item.key} onChange={() => setReason(item.key)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </fieldset>
            {error && <p className="mt-3 text-sm text-red-200" role="alert">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-11 rounded-lg border border-neutral-700 px-4 text-sm hover:bg-neutral-800">Cancel</button>
              <button type="button" onClick={submit} disabled={busy} className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">{busy ? "Sending…" : "Send report"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
