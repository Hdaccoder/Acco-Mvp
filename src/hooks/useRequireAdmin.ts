// src/hooks/useRequireAdmin.ts
'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';

function listFromEnv(key: string): string[] {
  const raw = process.env[key] || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/** Returns 'loading' | 'authorized' | 'unauthorized' */
export function useRequireAdmin() {
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');
  const adminEmails = useMemo(() => listFromEnv('NEXT_PUBLIC_ADMIN_EMAILS'), []);
  const adminUids   = useMemo(() => listFromEnv('NEXT_PUBLIC_ADMIN_UIDS'), []);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return setState('unauthorized');

      const emailOk = user.email && adminEmails.includes(user.email);
      const uidOk   = adminUids.length > 0 && adminUids.includes(user.uid);
      setState(emailOk || uidOk ? 'authorized' : 'unauthorized');
    });
    return () => unsub();
  }, [adminEmails, adminUids]);

  return state;
}

