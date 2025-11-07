'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  type DocumentData,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { getClientDb, getClientAuth, getIdTokenSafe } from '@/lib/firebase';
// from src/app/admin/houseparties/page.tsx
import { useRequireAdmin } from '../../../hooks/useRequireAdmin';

import AdminLogin from '@/components/AdminLogin';

type Houseparty = {
  id: string;
  name?: string;
  address?: string;
  kind?: 'pres' | 'afters' | 'all-night' | string;
  status?: 'pending' | 'active' | 'rejected';
  submittedBy?: string;
  createdAt?: any;
  notes?: string;
};

export default function AdminHousepartyPage() {
  const authState = useRequireAdmin(); // 'loading' | 'authorized' | 'unauthorized'
  const [pending, setPending] = useState<Houseparty[]>([]);
  const [loading, setLoading] = useState(true);
  const db = getClientDb();

  useEffect(() => {
    if (authState !== 'authorized') return;

    let cancelled = false;
    async function loadPending() {
      try {
        const snap = await getDocs(collection(db, 'houseparties'));
        if (cancelled) return;

        const items = snap.docs
          .map((d) => {
            const data = d.data() as DocumentData;
            return {
              id: d.id,
              name: data.name ?? '',
              address: data.address ?? '',
              kind: data.kind ?? '',
              status: data.status ?? 'pending',
              submittedBy: data.submittedBy ?? '',
              createdAt: data.createdAt,
              notes: data.notes ?? '',
            } as Houseparty;
          })
          .filter((p) => p.status === 'pending');

        setPending(items);
      } catch (e) {
        console.error('Failed to load pending houseparties:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPending();
    return () => { cancelled = true; };
  }, [authState, db]);

  async function moderate(id: string, action: 'approve' | 'reject') {
    try {
      const token = await getIdTokenSafe();
      const res = await fetch('/api/admin/houseparties/moderate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed');
      }
      setPending(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('Moderation failed', e);
      alert('Moderation failed.');
    }
  }

  function doSignOut() {
    const auth = getClientAuth();
    signOut(auth).catch(() => {});
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Houseparty Moderation</h1>
        {authState === 'authorized' ? (
          <button
            onClick={doSignOut}
            className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800"
          >
            Sign out
          </button>
        ) : null}
      </div>

      {authState === 'loading' && <p className="opacity-70">Checking permissions…</p>}

      {authState === 'unauthorized' && (
        <div className="flex items-start justify-center">
          <AdminLogin />
        </div>
      )}

      {authState === 'authorized' && (
        <>
          {loading ? (
            <p className="opacity-70">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="opacity-70">No pending submissions.</p>
          ) : (
            <div className="space-y-4">
              {pending.map((p) => (
                <div key={p.id} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-medium">{p.name || 'Untitled houseparty'}</div>
                      <div className="text-sm opacity-70">{p.address}</div>
                      <div className="text-sm opacity-70 mt-1">Type: {p.kind}</div>
                      {p.notes ? (
                        <div className="text-sm opacity-90 mt-2">
                          <span className="opacity-60">Notes:</span> {p.notes}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <button
                        onClick={() => moderate(p.id, 'approve')}
                        className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => moderate(p.id, 'reject')}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs opacity-60">
                    ID: {p.id} {p.submittedBy ? `· Submitted by ${p.submittedBy}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
