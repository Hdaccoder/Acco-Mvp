'use client';

import { useState } from 'react';
import { saveHouseparty } from '@/lib/housepartyStore';
import { nightKey } from '@/lib/dates';
import dynamic from 'next/dynamic';

// Lazy load map picker (client-only)
const MapPicker = dynamic(() => import('@/components/MapPicker'), {
  ssr: false,
});

type LatLng = { lat: number; lng: number };

export default function HousepartyClient() {
  const [kind, setKind] = useState<'pres' | 'afters' | 'all-night'>('all-night');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const night = nightKey(new Date());

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location) {
      alert('Please drop a pin on the map to set your houseparty location.');
      return;
    }
    setShowConfirm(true);
  }

  async function confirmPublish() {
    if (!location) return; // type guard

    try {
      setSubmitting(true);
      await saveHouseparty({
        name: name.trim() || 'Unnamed party',
        kind,
        address: address.trim(),
        notes: notes.trim(),
        nightKey: night,
        location, // non-null because of the guard above
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      });
      alert('✅ Houseparty added for tonight!');
      window.location.href = '/houseparties';
    } catch (err) {
      console.error('Error publishing houseparty:', err);
      alert('Something went wrong while publishing.');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-semibold mb-2">
        Add a Houseparty <span className="text-yellow-400">(Tonight)</span>
      </h1>
      <p className="text-neutral-400 mb-8">
        Share your pre’s, afters, or all-night party for tonight so people can find it.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <div className="flex gap-3">
            {(['pres', 'afters', 'all-night'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-4 py-2 rounded-full border transition ${
                  kind === k
                    ? 'bg-yellow-400 text-black'
                    : 'border-neutral-700 text-neutral-300 hover:border-yellow-400'
                }`}
              >
                {k === 'pres' ? "Pre's" : k === 'afters' ? 'Afters' : 'All Night'}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            placeholder="e.g., DJ Mike’s Bash"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Starts</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Ends</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium mb-2">Address / Building</label>
          <input
            type="text"
            placeholder="e.g., 12 Park Rd, Flat 3A, L39 ..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-yellow-400"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">Notes (optional)</label>
          <textarea
            placeholder="Anything guests should know? e.g., ‘Text on arrival’, ‘Bring your own drinks’, ‘Quiet after midnight’..."
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 h-28 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-yellow-400"
          />
          <p className="text-sm text-neutral-500 mt-1">Up to 500 characters.</p>
        </div>

        {/* Map */}
        <div>
          <label className="block text-sm font-medium mb-2">Location</label>
          {/* MapPicker.value expects a non-null LatLng in your codebase; pass undefined when empty */}
          <MapPicker value={location ?? undefined} onChange={setLocation} />
        </div>

        {/* Publish */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="bg-yellow-400 text-black font-medium rounded-lg px-6 py-3 hover:bg-yellow-300 disabled:opacity-60"
          >
            {submitting ? 'Publishing...' : 'Publish for Tonight'}
          </button>
        </div>
      </form>

      {/* Simple confirm dialog (no framer-motion) */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-neutral-950 p-6 rounded-xl shadow-xl w-[90%] max-w-md border border-neutral-800">
            <h2 className="text-lg font-semibold mb-3">Confirm publish?</h2>
            <p className="text-neutral-300 text-sm mb-4">
              Once you publish a houseparty,{' '}
              <span className="font-semibold text-yellow-400">you cannot take it down</span> for the rest of the night. Make sure the details are correct.
            </p>

            <ul className="text-sm text-neutral-400 mb-6 space-y-1">
              <li><span className="font-medium text-white">Name:</span> {name || '(none)'}</li>
              <li><span className="font-medium text-white">Type:</span> {kind}</li>
              <li><span className="font-medium text-white">Address:</span> {address || '(none)'}</li>
            </ul>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="text-neutral-400 hover:text-white px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublish}
                disabled={submitting}
                className="bg-yellow-400 text-black font-medium px-4 py-2 rounded-lg hover:bg-yellow-300 disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
