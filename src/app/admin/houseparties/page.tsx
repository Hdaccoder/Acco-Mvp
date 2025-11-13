// src/app/admin/houseparties/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import AdminLogin from '@/components/AdminLogin';

type Houseparty = {
  id: string;
  [key: string]: any;
};

export default function AdminHousepartyPage() {
  const { isAdmin, loading } = useRequireAdmin();
  const [pending, setPending] = useState<Houseparty[]>([]);
  const [busy, setBusy] = useState(false);

  // Only load data when we KNOW the user is an admin
  useEffect(() => {
    const load = async () => {
      if (!isAdmin) return;
      const db = getClientDb();
      const snap = await getDocs(collection(db, 'houseparties'));
      const items: Houseparty[] = [];

      snap.forEach((d) => {
        const data = d.data() as DocumentData;
        // Show only pending / flagged items – adjust as you like
        if (data.status === 'pending' || data.status === 'flagged') {
          items.push({ id: d.id, ...data });
        }
      });

      setPending(items);
    };

    load().catch((err) => console.error('[admin] load error', err));
  }, [isAdmin]);

  async function moderate(id: string, action: 'approve' | 'reject') {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const db = getClientDb();
      const ref = doc(db, 'houseparties', id);
      const status = action === 'approve' ? 'active' : 'rejected';
      await updateDoc(ref, { status });
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error('[admin] moderate error', e);
      alert('Something went wrong updating this houseparty.');
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------
  // RENDER
  // -----------------------------
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-200">Checking admin access…</p>
      </main>
    );
  }

  // Not an admin → show login UI
  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <AdminLogin />
      </main>
    );
  }

  // Admin view
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-3xl font-semibold mb-4">Houseparty Moderation</h1>
      {busy && (
        <p className="text-sm text-yellow-300">
          Updating… please wait a moment.
        </p>
      )}

      {pending.length === 0 ? (
        <p className="text-neutral-300">No houseparties waiting for review.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <div
              key={p.id}
              className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 flex flex-col gap-2"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="font-semibold text-lg">{p.title ?? 'Untitled houseparty'}</h2>
                  <p className="text-sm text-neutral-300">
                    Host: {p.hostName ?? 'Unknown'}
                  </p>
                  {p.address && (
                    <p className="text-sm text-neutral-400">{p.address}</p>
                  )}
                  {p.notes && (
                    <p className="text-sm text-neutral-400 mt-1">
                      Notes: {p.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  disabled={busy}
                  onClick={() => moderate(p.id, 'approve')}
                  className="px-3 py-1 rounded-md bg-green-600 hover:bg-green-500 text-sm"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => moderate(p.id, 'reject')}
                  className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-sm"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
