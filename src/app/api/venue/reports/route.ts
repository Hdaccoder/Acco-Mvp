import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { nightKey } from "@/lib/dates";
import { clientIp, noStoreHeaders, rateLimit } from "@/lib/api-security";

export async function GET(req: Request) {
  const limited = rateLimit(`reports:${clientIp(req)}`, 120, 60_000);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const requestedKey = url.searchParams.get("for") || nightKey();
    if (!/^\d{8}$/.test(requestedKey)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    const snap = await adminDb().collection("venueReports").where("nightKey", "==", requestedKey).limit(500).get();
    const reportsByVenue: Record<string, { count: number; entries: never[] }> = {};
    snap.forEach((document) => {
      const venueId = String(document.data().venueId || "");
      if (!venueId) return;
      reportsByVenue[venueId] ??= { count: 0, entries: [] };
      reportsByVenue[venueId].count += 1;
    });
    return NextResponse.json({ reportsByVenue }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[GET /api/venue/reports]", error);
    return NextResponse.json({ error: "Unable to load report totals." }, { status: 500 });
  }
}
