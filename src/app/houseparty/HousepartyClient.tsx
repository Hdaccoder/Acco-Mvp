// src/app/houseparty/HousepartyClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MapPicker from '@/components/MapPicker';
import { auth } from '@/lib/firebase';

type Kind = 'pres' | 'afters' | 'all-night';

export default function HousepartyClient() {
  const [kind, setKind] = useState<Kind>('all-night');
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const start = new Date();
    start.setHours(Math.max(20, now.getHours()), 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 4);
    setStartsAt(start.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
  }, []);

  async function getIdTokenSafe(): Promise<string> {
    try {
      // Optional chain through currentUser; returns '' if not signed in
      const token = await auth?.currentUser?.getIdToken();
      return token ?? '';
    } catch {
      return '';
    }
  }

  async function onPublish() {
    setMsg(null);
    if (!agree) return setMsg('Please confirm this is a real event.');
    if (!coords) return setMsg('Pick a location.');
    if (!startsAt || !endsAt) return setMsg('Choose start and end times.');

    try {
      setSaving(true);
      const token = await getIdTokenSafe();

      const res = await fetch('/api/houseparty/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish');

      setMsg(
        data?.status === 'pending'
          ? 'Thanks! Your party was submitted and is pending review.'
          : 'Published! It will appear on the map shortly.'
      );

      setName('');
      setNotes('');
    } catch (e: any) {
      setMsg(e?.message || 'Failed to publish');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Add a Houseparty (Tonight)
        </h1>
        <Link
          href="/houseparties"
          className="inline-flex items-center rounded-md border border-white/20 px-3 py-2 text-sm text-white hover:border-white/40"
        >
          View all
        </Link>
      </div>

      <p className="mt-3 text-sm text-neutral-300">
        Real events only. Spam or fake events are removed and may restrict your account.
      </p>

      {/* Type */}
      <div className="mt-6">
        <label className="block mb-2 text-sm text-neutral-300">Type</label>
        <div className="flex gap-2">
          {([
            { k: 'pres', label: "Pre's" },
            { k: 'afters', label: 'Afters' },
            { k: 'all-night', label: 'All night' },
          ] as const).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setKind(opt.k)}
              className={`rounded-full px-3 py-1 text-sm ${
                kind === opt.k
                  ? 'bg-white text-black'
                  : 'border border-white/20 text-white hover:border-white/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Times */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block mb-2 text-sm text-neutral-300">Starts</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm text-neutral-300">Ends</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none"
          />
        </div>
      </div>

      {/* Text fields */}
      <div className="mt-6 grid grid-cols-1 gap-4">
        <div>
          <label className="block mb-2 text-sm text-neutral-300">Name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Dj Mike’s"
            className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm text-neutral-300">Address / Building</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g., 12 Park Rd, Flat 3A"
            className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none"
          />
        </div>
        <div>
          <label className="block mb-2 text-sm text-neutral-300">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything guests should know?"
            rows={4}
            className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none"
          />
        </div>
      </div>

      {/* Location */}
      <section className="mt-6">
        <label className="block mb-2 text-sm text-neutral-300">Location</label>
        <div className="rounded-xl overflow-hidden border border-white/10">
          <MapPicker value={coords} onChange={setCoords} height={320} />
        </div>
        {coords && (
          <p className="mt-2 text-xs text-neutral-400">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}
      </section>

      {/* Affirmation */}
      <label className="mt-6 flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I confirm this is a real event. I understand fake posts will be removed.
      </label>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onPublish}
          disabled={saving}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-80 disabled:opacity-50"
        >
          {saving ? 'Publishing…' : 'Publish for Tonight'}
        </button>
        {msg && <span className="text-sm text-neutral-300">{msg}</span>}
      </div>
    </main>
  );
}
