"use client";

import { useCallback, useEffect, useState } from "react";
import { nightKey } from "@/lib/dates";
import type { PredictionItem, PublicTally } from "@/lib/popularity";

type Mode = "nightlife" | "food";
type ReportSummary = { count: number; entries: never[] };

type PopularityPayload = {
  tallies: Record<string, PublicTally>;
  arrivalCounts: Record<string, Record<string, number>>;
  sentiment: { yesMaybe: number; no: number };
  totalParticipants: number;
  totalSelections: number;
  generatedAt: string | null;
  predictions: Record<string, PredictionItem>;
  predictionGeneratedAt: string | null;
};

const emptyData: PopularityPayload = {
  tallies: {},
  arrivalCounts: {},
  sentiment: { yesMaybe: 0, no: 0 },
  totalParticipants: 0,
  totalSelections: 0,
  generatedAt: null,
  predictions: {},
  predictionGeneratedAt: null,
};

export function usePopularityData(mode: Mode) {
  const [data, setData] = useState<PopularityPayload>(emptyData);
  const [reports, setReports] = useState<Record<string, ReportSummary>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true); else setLoading(true);
    try {
      const key = nightKey();
      const [popularityResponse, reportsResponse, predictionsResponse] = await Promise.all([
        fetch(`/api/tallies?mode=${mode}&night=${key}`),
        fetch(`/api/venue/reports?for=${key}`),
        fetch(`/api/predictions?mode=${mode}`),
      ]);
      if (!popularityResponse.ok) throw new Error("Live popularity is temporarily unavailable.");
      const body = await popularityResponse.json();
      const predictionsBody = predictionsResponse.ok ? await predictionsResponse.json() : {};
      setData({
        tallies: body.tallies || {},
        arrivalCounts: body.arrivalCounts || {},
        sentiment: body.sentiment || { yesMaybe: 0, no: 0 },
        totalParticipants: body.totalParticipants || 0,
        totalSelections: body.totalSelections || 0,
        generatedAt: body.generatedAt || null,
        predictions: predictionsBody.items || {},
        predictionGeneratedAt: predictionsBody.generatedAt || null,
      });
      if (reportsResponse.ok) {
        const reportBody = await reportsResponse.json();
        setReports(reportBody.reportsByVenue || {});
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load live popularity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    void load(false);
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [load]);

  return { ...data, reports, loading, refreshing, error, refresh: () => load(true) };
}
