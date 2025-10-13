// src/components/EnsureSummary.tsx
"use client";
import { useEffect } from "react";
import { ensureYesterdaySummary } from "@/lib/summarize";

export default function EnsureSummary() {
  useEffect(() => {
    ensureYesterdaySummary().catch(() => {});
  }, []);
  return null;
}
