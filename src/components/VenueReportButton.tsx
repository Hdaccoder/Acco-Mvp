"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

type Reason = { key: string; label: string };

export default function VenueReportButton({ id, reasons }: { id: string; reasons?: Reason[] }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons && reasons.length > 0 ? reasons[0].key : "spiking");

  async function getIdTokenSafe(): Promise<string> {
    try {
      const token = await auth?.currentUser?.getIdToken();
      return token ?? "";
    } catch {
      return "";
    }
  }

  async function submit() {
    if (busy || done) return;
    setBusy(true);
    try {
      const token = await getIdTokenSafe();
      await fetch('/api/venue/report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ venueId: id, reason }),
      });
      setDone(true);
      setOpen(false);
    } catch (e) {
      console.error('report error', e);
    }
    setBusy(false);
  }

  if (hidden) return null;

  if (done) {
    return (
      <button
        onClick={() => setHidden(true)}
        className="text-xs rounded-md border border-white/20 px-2 py-1 text-white hover:border-white/40"
        title="Click to dismiss"
      >
        Reported
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="text-xs rounded-md border border-white/20 px-2 py-1 text-white hover:border-white/40"
      >
        Report
      </button>

      {open && (
        <div className="mt-2 p-3 bg-neutral-900 border border-neutral-700 rounded-md">
          <div className="text-sm text-neutral-300 mb-2">Report this venue for:</div>
          <div className="flex gap-2 mb-3">
            {(reasons ?? [
              { key: 'spiking', label: 'Spiking' },
              { key: 'fight', label: 'Fight' },
              { key: 'bouncers', label: 'Bouncers' },
              { key: 'other', label: 'Other' },
            ]).map((r) => (
              <button key={r.key} onClick={() => setReason(r.key)} className={`px-2 py-1 rounded ${reason===r.key? 'bg-red-700' : 'bg-neutral-800'}`}>{r.label}</button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-sm">Send</button>
            <button onClick={() => setOpen(false)} disabled={busy} className="px-3 py-1 rounded-md bg-neutral-800 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
