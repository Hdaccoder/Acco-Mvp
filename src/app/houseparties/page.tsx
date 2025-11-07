'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ReportButton from '@/components/ReportButton';

type HP = {
  id: string;
  name?: string;
  kind?: string;
  address?: string;
  notes?: string;
  startsAt?: string; // ISO
  endsAt?: string;   // ISO
  nightKey: string;
  location?: { lat: number; lng: number };
};

type Range = 'tonight' | 'recent';

export default function HousepartiesPage() {
  const [range, setRange] = useState<Range>('tonight');
  const [items, setItems] = useState<HP[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const endpoint = useMemo(
    () => `/api/houseparty/list?range=${range}`,
    [range]
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) {
          if (ct.includes('application/json')) {
            const j = await res.json();
            throw new Error(j?.error || 'Failed to load houseparties.');
          } else {
            throw new Error(`Failed to load houseparties (HTTP ${res.status}).`);
          }
        }
        if (!ct.includes('application/json')) {
          throw new Error('Unexpected response format.');
        }
        const { items } = (await res.json()) as { items: HP[] };
        if (alive) setItems((items ?? []).sort(sortByStartAsc));
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Failed to load houseparties.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Houseparties</h1>
        <Link
          href="/houseparty"
          className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-80"
        >
          + Add Houseparty
        </Link>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setRange('tonight')}
          className={`rounded-full px-3 py-1 text-sm ${
            range === 'tonight'
              ? 'bg-white text-black'
              : 'border border-white/20 text-white hover:border-white/40'
          }`}
        >
          Tonight
        </button>
        <button
          onClick={() => setRange('recent')}
          className={`rounded-full px-3 py-1 text-sm ${
            range === 'recent'
              ? 'bg-white text-black'
              : 'border border-white/20 text-white hover:border-white/40'
          }`}
        >
          Last 7 days
        </button>
      </div>

      <section className="mt-6 space-y-4">
        {loading && (
          <div className="rounded-xl border border-white/10 bg-gray-900 p-4 text-sm text-gray-300">
            Loading…
          </div>
        )}
        {err && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200">
            {err}
          </div>
        )}
        {!loading && !err && items.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-gray-900 p-6 text-sm text-gray-300">
            {range === 'tonight'
              ? 'No houseparties have been added for tonight yet.'
              : 'No recent houseparties found for the last 7 days.'}
          </div>
        )}

        {items.map((hp) => (
          <article
            key={hp.id}
            className="rounded-xl border border-white/10 bg-gray-900 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              {/* left content */}
              <div>
                <h2 className="text-lg font-medium text-white">
                  {hp.name || 'Houseparty'}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  {formatKind(hp.kind)}
                  {hp.startsAt || hp.endsAt ? <> · {formatWindow(hp.startsAt, hp.endsAt)}</> : null}
                </p>
                {hp.address && (
                  <p className="mt-1 text-sm text-gray-300">{hp.address}</p>
                )}
                {hp.notes && (
                  <p className="mt-2 text-sm text-gray-400">{hp.notes}</p>
                )}
              </div>

              {/* right actions */}
              <div className="flex items-center gap-2">
                {hp.location && (
                  <a
                    href={`https://www.google.com/maps?q=${hp.location.lat},${hp.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-white/20 px-3 py-2 text-xs text-white hover:border-white/40"
                  >
                    Navigate
                  </a>
                )}
                <ReportButton id={hp.id} />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">Night: {hp.nightKey}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function sortByStartAsc(a: HP, b: HP) {
  const ta = a.startsAt ? Date.parse(a.startsAt) : 0;
  const tb = b.startsAt ? Date.parse(b.startsAt) : 0;
  return ta - tb;
}

function formatKind(kind?: string) {
  if (!kind) return 'Type: unknown';
  if (kind === 'pres') return "Type: Pre's";
  if (kind === 'afters') return 'Type: Afters';
  if (kind === 'all-night') return 'Type: All night';
  return `Type: ${kind}`;
}

function formatWindow(starts?: string, ends?: string) {
  try {
    const f = (s: string) =>
      new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (starts && ends) return `${f(starts)}–${f(ends)}`;
    if (starts) return `from ${f(starts)}`;
    if (ends) return `until ${f(ends)}`;
  } catch {}
  return '';
}
