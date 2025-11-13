// src/hooks/useRequireAdmin.ts
'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';

// 🔐 Only this email is allowed to use the admin tools.
const ADMIN_EMAIL = 'paul.is.in.power@gmail.com';

export function useRequireAdmin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();

    const unsub = onAuthStateChanged(auth, (u) => {
      console.log('[admin] auth state changed. User:', u?.email ?? 'none');
      setUser(u);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const isAdmin =
    !!user &&
    !!user.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  console.log('[admin] isAdmin:', isAdmin);

  return { user, loading, isAdmin };
}
