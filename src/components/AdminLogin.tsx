'use client';

import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  linkWithPopup,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signInGoogle() {
    setErr(null); setBusy(true);
    try {
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      if (auth.currentUser?.isAnonymous) {
        await linkWithPopup(auth.currentUser, provider); // upgrade anon → Google
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setErr(e?.message ?? 'Email sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm w-full rounded-xl bg-neutral-900 border border-neutral-800 p-5">
      <h2 className="text-lg font-semibold mb-3">Admin login</h2>

      <button
        disabled={busy}
        onClick={signInGoogle}
        className="w-full rounded-lg bg-neutral-100 text-black py-2.5 font-medium hover:bg-white disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-800" />
        <div className="text-xs uppercase tracking-wide opacity-60">or</div>
        <div className="h-px flex-1 bg-neutral-800" />
      </div>

      <form onSubmit={signInEmail} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 outline-none focus:border-yellow-400"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 outline-none focus:border-yellow-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy}
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-yellow-500 text-black py-2.5 font-semibold hover:bg-yellow-400 disabled:opacity-60"
          disabled={busy}
        >
          Sign in
        </button>
      </form>

      {err ? <p className="text-sm text-red-400 mt-3">{err}</p> : null}

      <p className="text-xs opacity-60 mt-4">
        Only approved admin accounts can access the moderation tools.
      </p>
    </div>
  );
}
