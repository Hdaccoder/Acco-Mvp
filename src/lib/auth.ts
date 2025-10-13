"use client";

import { auth } from "@/lib/firebase";

export async function ensureAnon(): Promise<string | null> {
  if (typeof window === "undefined" || !auth) return null;

  // Narrow to a local non-null variable for TypeScript
  const a = auth as import("firebase/auth").Auth;

  try {
    const mod = (await import("firebase/auth")) as typeof import("firebase/auth");
    const { signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, inMemoryPersistence } = mod;

    try {
      await setPersistence(a, browserLocalPersistence);
    } catch {
      await setPersistence(a, inMemoryPersistence);
    }

    if (!a.currentUser) await signInAnonymously(a);

    return await new Promise<string | null>((resolve) => {
      const off = onAuthStateChanged(a, (u) => {
        if (u) { resolve(u.uid); off(); }
      });
      setTimeout(() => resolve(a.currentUser?.uid ?? null), 5000);
    });
  } catch (e) {
    console.error("ensureAnon error (non-fatal):", e);
    return null;
  }
}
