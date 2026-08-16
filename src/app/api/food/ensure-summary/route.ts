import { NextRequest, NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/api-security";
import { ensurePredictionForNight, generateFoodPredictionForNight } from "@/lib/predictions";
import { nightKey, nightKeyAtOffset } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const requested = req.nextUrl.searchParams.get("for");
    const backfill = Math.min(30, Math.max(0, Number(req.nextUrl.searchParams.get("backfill") || 0)));
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
    const keys = backfill
      ? Array.from({ length: backfill }, (_, index) => nightKeyAtOffset(index - backfill))
      : [requested && /^\d{8}$/.test(requested) ? requested : nightKey()];
    const generated: string[] = [];
    const reused: string[] = [];
    const generating: string[] = [];
    for (const key of keys) {
      if (dryRun) {
        await generateFoodPredictionForNight(key);
        generated.push(key);
        continue;
      }
      const ensured = await ensurePredictionForNight(key, "food");
      if (ensured.status === "generating") generating.push(key);
      else if (ensured.generatedOnDemand) generated.push(key);
      else reused.push(key);
    }
    return NextResponse.json({ ok: true, generated, reused, generating, dryRun });
  } catch (error) {
    console.error("[GET /api/food/ensure-summary]", error);
    return NextResponse.json({ error: "Unable to generate food forecast." }, { status: 500 });
  }
}
