import { NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/api-security";
import { ensurePredictionForNight } from "@/lib/predictions";
import { nightKey } from "@/lib/dates";

export async function POST(req: Request) {
  if (!hasCronSecret(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const key = nightKey();
    const ensured = await ensurePredictionForNight(key, "nightlife");
    if (ensured.status === "generating") {
      return NextResponse.json({ ok: true, status: "generating", generated: key }, { status: 202 });
    }
    return NextResponse.json({ ok: true, generated: key, reused: !ensured.generatedOnDemand });
  } catch (error) {
    console.error("[POST /api/ensure-summary/trigger]", error);
    return NextResponse.json({ ok: false, error: "Unable to generate forecast." }, { status: 500 });
  }
}
