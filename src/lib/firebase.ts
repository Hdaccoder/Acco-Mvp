// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';

// Public (client) envs
const apiKey              = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const authDomain          = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
const projectId           = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const storageBucket       = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
const messagingSenderId   = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '';
const appId               = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';

const hasConfig =
  apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId;

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

// Initialize once (client)
try {
  if (hasConfig) {
    _app =
      getApps().length > 0
        ? getApps()[0]!
        : initializeApp({
            apiKey,
            authDomain,
            projectId,
            storageBucket,
            messagingSenderId,
            appId,
          });

    _db = initializeFirestore(_app, {
      experimentalAutoDetectLongPolling: true,
    });

    if (typeof window !== 'undefined') {
      _auth = getAuth(_app);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn('Firebase config incomplete; skipping init. Check .env.local');
  }
} catch (e) {
  console.error('Firebase init error (non-fatal):', e);
  _app = null;
  _db = null;
  _auth = null;
}

/** Legacy named exports (if other parts of the app still use them) */
export const app = _app;
export const db = _db;
export const auth = _auth;

/** Preferred getters (always return the cached singleton or throw if unavailable) */
export function getClientApp(): FirebaseApp {
  if (!_app) throw new Error('Firebase App not initialized (client). Check env vars.');
  return _app;
}

export function getClientDb(): Firestore {
  if (!_db) throw new Error('Firestore not initialized (client).');
  return _db;
}

export function getClientAuth(): Auth {
  if (!_auth) throw new Error('Auth not initialized (client).');
  return _auth;
}

/** Safely get an ID token (returns '' if not signed in) */
export async function getIdTokenSafe(): Promise<string> {
  try {
    const a = getClientAuth();
    const u = a.currentUser;
    if (!u) return '';
    return await u.getIdToken();
  } catch {
    return '';
  }
}
