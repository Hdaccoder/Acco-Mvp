// src/lib/firebase-admin.ts
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _app: App | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

const getAdminApp = (): App => {
  if (_app) return _app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Missing Firebase Admin env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  _app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });

  return _app;
};

export const adminDb = (): Firestore => {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db!;
};

export const adminAuth = (): Auth => {
  if (_auth) return _auth;
  _auth = getAuth(getAdminApp());
  return _auth!;
};
