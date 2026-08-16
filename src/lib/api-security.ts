import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

type RateRecord = { count: number; resetAt: number };
const rateRecords = new Map<string, RateRecord>();

export function clientIp(req: Request) {
  return req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateRecords.get(key);
  if (!current || current.resetAt <= now) {
    rateRecords.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (current.count >= limit) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((current.resetAt - now) / 1000)) },
    });
  }
  current.count += 1;
  return null;
}

export async function requireUser(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try { return await adminAuth().verifyIdToken(token); } catch { return null; }
}

export function hasCronSecret(req: Request) {
  const configured = process.env.CRON_SECRET;
  return Boolean(configured && req.headers.get("authorization") === `Bearer ${configured}`);
}

export const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };
