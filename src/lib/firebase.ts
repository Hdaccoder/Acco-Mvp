// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

// Use DOT notation so Next.js inlines these on the client
const apiKey        = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const authDomain    = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
const projectId     = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
const appId         = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";

const hasConfig =
  apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  if (hasConfig) {
    app =
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

    // Prefer long-polling in dev to avoid ad blockers / proxies blocking gRPC
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      // useFetchStreams: false,
    });

    if (typeof window !== "undefined") {
      auth = getAuth(app);
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("Firebase config incomplete; skipping init. Check .env.local");
  }
} catch (e) {
  console.error("Firebase init error (non-fatal):", e);
  app = null;
  db = null;
  auth = null;
}

export { app, db, auth };
