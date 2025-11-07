// src/components/ReportButton.tsx
'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';

export default function ReportButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function getIdTokenSafe(): Promise<string> {
    try {
      const token = await auth?.currentUser?.getIdToken();
      return token ?? '';
    } catch {
      return '';
    }
  }

  async function onReport() {
    if (busy || done) return;
    setBusy(true);
    try {
      const token = await getIdTokenSafe();
      await fetch('/api/houseparty/report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ housepartyId: id, reason: 'spam' }),
      });
      setDone(true);
    } catch {
      // ignore
    }
    setBusy(false);
  }

  return (
    <button
      onClick={onReport}
      disabled={busy || done}
      className="text-xs rounded-md border border-white/20 px-2 py-1 text-white hover:border-white/40 disabled:opacity-50"
      title="Report this post"
    >
      {done ? 'Reported' : busy ? 'Reporting…' : 'Report'}
    </button>
  );
}
