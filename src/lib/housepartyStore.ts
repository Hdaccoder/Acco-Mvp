// src/lib/housepartyStore.ts
'use client';

import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';

export type HousepartyInput = {
  name?: string;
  kind: 'pres' | 'afters' | 'all-night';
  address?: string;
  notes?: string;
  nightKey: string; // e.g. '20251106'
  location: { lat: number; lng: number }; // non-null
  startsAt?: string | null; // ISO
  endsAt?: string | null;   // ISO
};

export async function saveHouseparty(input: HousepartyInput) {
  // Your db type is Firestore | null in this project; assert non-null on client.
  const database = db as unknown as Firestore;

  const startsAtTs =
    input.startsAt ? Timestamp.fromDate(new Date(input.startsAt)) : null;

  return addDoc(collection(database, 'houseparties'), {
    ...input,
    startsAtTs,
    createdAt: serverTimestamp(),
  });
}
