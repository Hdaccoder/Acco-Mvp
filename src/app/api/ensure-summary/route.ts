// src/app/api/ensure-summary/route.ts
import { NextResponse } from "next/server";
import { adminDb, getAdminApp } from "@/lib/firebase-admin"; // your working admin helper

export const runtime = "nodejs"; // ensure Node runtime (not Edge)

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function extractKey(req: Request, url: URL) {
  // 1) x-cron-key header
  let key = req.headers.get("x-cron-key")?.trim();

  // 2) Authorization: Bearer <token>
  if (!key) {
    const auth = req.headers.get("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      key = auth.slice(7).trim();
    }
  }

  // 3) Local dev helper (?key=...) – only for NODE_ENV !== "production"
  if (!key && process.env.NODE_ENV !== "production") {
    const q = url.searchParams.get("key");
    if (q) key = q.trim();
  }

  return key || "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  // Make sure env was loaded
  if (!CRON_SECRET) {
    console.warn("ensure-summary: CRON_SECRET missing in env");
    return NextResponse.json(
      { error: "Server not configured (missing CRON_SECRET)" },
      { status: 500 }
    );
  }

  const provided = extractKey(req, url);

  if (provided !== CRON_SECRET) {
    // Helpful diagnostics while testing locally
    console.warn("ensure-summary 401", {
      hasXHeader: !!req.headers.get("x-cron-key"),
      hasAuth: !!req.headers.get("authorization"),
      hasEnv: !!CRON_SECRET,
      nodeEnv: process.env.NODE_ENV,
    });

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Your existing summary logic starts here ---
  try {
    // Ensure Admin app available
    getAdminApp();
    const db = adminDb();

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true });
    }

    // TODO: build & write tonight's summary (your current implementation)
    // await writeSummary(db);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ensure-summary error:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
