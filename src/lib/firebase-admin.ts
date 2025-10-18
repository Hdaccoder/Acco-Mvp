// src/lib/firebase-admin.ts
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Lazily initialize a single Admin app instance.
 */
let _app: App | null = null;

export function getAdminApp(): App {
  if (_app) return _app;

  _app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // NOTE: many providers escape newlines in env vars
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });

  return _app;
}

/**
 * Admin Firestore instance (modular API).
 */
export function adminDb() {
  return getFirestore(getAdminApp());
}

export type AdminDB = ReturnType<typeof adminDb>;
