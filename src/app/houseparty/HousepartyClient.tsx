'use client';

import { useMemo, useState } from 'react';
import MapPicker from '@/components/MapPicker';
import { PartyKind } from '@/lib/houseparty';
import { nightKey } from '@/lib/dates';

export default function HousepartyPage() {
  // Default times: tonight 20:00–02:00
  const defaults = useMemo(() => {
    const now = new Date();
    const nk = nightKey(now);
    const start = new Date();
    start.setHours(20, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + (start.getHours() >= 18 ? 1 : 0));
    end.setHours(2, 0, 0, 0);

    const pad = (n: number) => `${n}`.padStart(2, '0');
    const toLocalInput = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;

    return { nk, startStr: toLocalInput(start), endStr: toLocalInput(end) };
  }, []);

  // Form state
  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof PartyKind)[number]>('all-night');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [startsAt, setStartsAt] = useState(defaults.startStr);
  const [endsAt, setEndsAt] = useState(defaults.endStr);

  // UI state
  const [status, setStatus] = useState<'idle' | 'confirm' | 'submitting' | 'success' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);

  const openConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!coords) {
      setError('Please choose a location on the map.');
      return;
    }
    if (!name.trim()) {
      setError('Please provide a name for the houseparty.');
      return;
    }

    setStatus('confirm');
  };

  const actuallySubmit = async () => {
    setStatus('submitting');
    setError(null);

    try {
      const res = await fetch('/api/houseparty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          kind,
          address,
          notes,
          location: coords,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to submit.');
      }

      setStatus('success');
      // Clear fields except times/kind
      setName('');
      setAddress('');
      setNotes('');
      setCoords(null);
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Something went wrong.');
    }
  };

  const closeConfirm = () => {
    if (status === 'confirm') setStatus('idle');
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 md:py-10 text-white">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Add a Houseparty (Tonight)
      </h1>
      <p className="mt-2 text-sm text-gray-300">
        Share your pre’s, afters, or all-night party for tonight so people can find it.
      </p>

      <form onSubmit={openConfirm} className="mt-6 space-y-6">
        {/* Name */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-100">Name</span>
          <input
            type="text"
            required
            placeholder="e.g., Park Road Pre’s"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <p className="mt-1 text-xs text-gray-500">Give it a short, clear title (max 60 chars).</p>
        </label>

        {/* Type */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-gray-100">Type</legend>
          <div className="flex flex-wrap gap-3">
            {(['pres', 'afters', 'all-night'] as const).map((k) => (
              <label
                key={k}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm capitalize transition ${
                  kind === k
                    ? 'bg-white text-black border-white'
                    : 'border-gray-600 text-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  className="sr-only"
                  checked={kind === k}
                  onChange={() => setKind(k)}
                />
                {k === 'pres' ? "Pre's" : k === 'afters' ? 'Afters' : 'All Night'}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Time inputs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-100">Starts</span>
            <input
              type="datetime-local"
              required
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-100">Ends</span>
            <input
              type="datetime-local"
              required
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>

        {/* Address */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-100">Address / Building</span>
          <input
            type="text"
            required
            placeholder="e.g., 12 Park Rd, Flat 3A, L39 …"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
          />
        </label>

        {/* Notes */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-100">Notes (optional)</span>
          <textarea
            placeholder="Anything guests should know? e.g., ‘Text on arrival’, ‘Bring your own drinks’, ‘Quiet after midnight’…"
            className="min-h-[96px] w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
          <p className="mt-1 text-xs text-gray-500">Up to 500 characters.</p>
        </label>

        {/* Map picker */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-100">Location</span>
            {coords && (
              <span className="text-xs text-gray-400">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            )}
          </div>
          <MapPicker value={coords} onChange={setCoords} />
          <p className="mt-2 text-xs text-gray-500">Click the map to drop or move the pin.</p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-80 disabled:opacity-50"
          >
            {status === 'submitting' ? 'Submitting…' : 'Publish for Tonight'}
          </button>
          {status === 'success' && (
            <span className="text-sm text-green-400">Added! It’ll appear shortly.</span>
          )}
          {status === 'error' && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </form>

      {/* Confirm modal */}
      {status === 'confirm' && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hp-confirm-title"
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-gray-900 p-5 shadow-xl">
            <h2 id="hp-confirm-title" className="text-lg font-semibold text-white">
              Confirm publish?
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              Once you publish a houseparty, you <span className="font-semibold">cannot take it
              down for the rest of the night</span>. Make sure the details are correct.
            </p>

            <div className="mt-4 space-y-1 text-xs text-gray-400">
              <div><span className="text-gray-500">Name:</span> {name || '—'}</div>
              <div><span className="text-gray-500">Type:</span> {kind}</div>
              <div><span className="text-gray-500">Starts:</span> {startsAt}</div>
              <div><span className="text-gray-500">Ends:</span> {endsAt}</div>
              <div><span className="text-gray-500">Address:</span> {address || '—'}</div>
              {notes?.trim() && <div><span className="text-gray-500">Notes:</span> {notes}</div>}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-md border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={actuallySubmit}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:opacity-80"
              >
                Yes, publish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
