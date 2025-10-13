// src/lib/summarize.ts
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { VENUES } from "@/lib/venues";

function yKeyNow(): string {
  const dt = new Date();
  // same 5AM cutoff used in your nightKey function:
  if (dt.getHours() < 5) dt.setDate(dt.getDate() - 1);
  // we want *yesterday*, so subtract one more day:
  dt.setDate(dt.getDate() - 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export async function ensureYesterdaySummary(): Promise<void> {
  if (!db) return;
  const key = yKeyNow();

  const votesCol = collection(db, "nights", key, "votes");
  const snap = await getDocs(votesCol); // only when summary missing—cheap once a day

  // aggregate
  const venues: Record<string, { yes: number; maybe: number; voters: number }> = {};
  for (const v of VENUES) venues[v.id] = { yes: 0, maybe: 0, voters: 0 };

  let stayIn = 0;
  snap.forEach((docSnap) => {
    const v = docSnap.data() as any;
    if (v.intent === "no") {
      stayIn += 1;
      return;
    }
    for (const s of v.selections ?? []) {
      const id = s?.venueId as string;
      if (!id || !venues[id]) continue;
      venues[id].voters += 1;
      if (v.intent === "yes") venues[id].yes += 1;
      else if (v.intent === "maybe") venues[id].maybe += 1;
    }
  });

  const payload = {
    createdAt: new Date(),
    stayIn,
    venues,
  };

  // try to create immutable summary; if it already exists, this throws and we ignore
  try {
    await setDoc(doc(db, "nights", key, "summary"), payload, { merge: false });
  } catch {
    // someone else created it—fine
  }
}
