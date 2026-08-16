"use client";

import { useState } from "react";
import Link from "next/link";
import VenueReportButton from "./VenueReportButton";
import { confidenceLabels, statusLabels, type Confidence, type PopularityStatus, type Trend } from "@/lib/popularity";

type Props = {
  id: string;
  name: string;
  voters: number;
  heatScore: number;
  lat: number;
  lng: number;
  rank?: number;
  peakToday?: string | null;
  price?: number | string | null;
  reports?: { count: number; entries: unknown[] };
  foodMode?: boolean;
  confidence?: Confidence;
  status?: PopularityStatus;
  forecastIndex?: number;
  trend?: Trend;
  distanceMiles?: number | null;
  foodMeta?: { avgPrice?: number; popularDays?: string[] };
  nightMeta?: { popularTimes?: string[]; popularDay?: string };
  reportReasons?: { key: string; label: string }[];
  comparisonLabel?: string;
};

const trendLabels: Record<Trend, string> = { up: "Rising", steady: "Steady", down: "Cooling" };
const statusStyles: Record<PopularityStatus, string> = {
  popular: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  trending: "bg-amber-500/15 text-amber-100 border-amber-400/30",
  usual: "bg-blue-500/15 text-blue-100 border-blue-400/30",
  early: "bg-neutral-800 text-neutral-200 border-neutral-700",
  quiet: "bg-emerald-500/10 text-emerald-100 border-emerald-400/20",
};

export default function VenueCard({
  id,
  name,
  voters,
  heatScore,
  lat,
  lng,
  rank,
  peakToday,
  price = null,
  reports,
  foodMode = false,
  confidence = "low",
  status = "early",
  forecastIndex = 0,
  trend = "steady",
  distanceMiles = null,
  foodMeta,
  nightMeta,
  reportReasons,
  comparisonLabel = "the selected area",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const voteHref = foodMode ? `/food/vote?venue=${encodeURIComponent(id)}` : `/vote?venue=${encodeURIComponent(id)}`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  const detailsId = `venue-details-${id}`;

  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank && <span className="text-sm font-semibold text-yellow-300" aria-label={`Rank ${rank}`}>#{rank}</span>}
            <h3 className="text-lg font-semibold text-white">{name}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
              {statusLabels[status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {voters === 0 ? "No live votes yet" : `${voters} live ${voters === 1 ? "vote" : "votes"}`}
            {distanceMiles != null ? ` · ${distanceMiles < 0.1 ? "Nearby" : `${distanceMiles.toFixed(1)} mi away`}` : ""}
          </p>
        </div>
        {price != null && <p className="text-sm text-neutral-200">Average £{Math.round(Number(price))}</p>}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-neutral-400">
          <span>Live popularity index</span>
          <span className="font-semibold tabular-nums text-white">{heatScore}/100</span>
        </div>
        <meter className="popularity-meter h-3 w-full" min="0" max="100" value={heatScore} aria-label={`${name} live popularity index ${heatScore} out of 100`} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div><dt className="text-neutral-500">Forecast</dt><dd className="font-medium text-neutral-200">{forecastIndex}/100</dd></div>
        <div><dt className="text-neutral-500">Signal</dt><dd className="font-medium text-neutral-200">{trendLabels[trend]}</dd></div>
        <div><dt className="text-neutral-500">Confidence</dt><dd className="font-medium text-neutral-200">{confidenceLabels[confidence].replace(" confidence", "")}</dd></div>
        <div><dt className="text-neutral-500">Expected peak</dt><dd className="font-medium text-neutral-200">{peakToday || "Not known yet"}</dd></div>
      </dl>

      {reports && reports.count > 0 && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100" role="note">
          {reports.count} community safety {reports.count === 1 ? "report" : "reports"} today. Use your own judgement.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={voteHref} className="inline-flex min-h-11 items-center rounded-lg bg-yellow-400 px-3 text-sm font-semibold text-black hover:bg-yellow-300">
          Vote here
        </Link>
        <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-sm text-white hover:bg-neutral-700">
          Directions<span className="sr-only"> to {name}, opens in a new tab</span>
        </a>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={detailsId} className="min-h-11 rounded-lg border border-neutral-700 px-3 text-sm text-white hover:bg-neutral-800">
          {expanded ? "Hide details" : "More details"}
        </button>
        <VenueReportButton id={id} reasons={reportReasons} />
      </div>

      {expanded && (
        <div id={detailsId} className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 text-sm text-neutral-300">
          {foodMode ? (
            <p>Historical average price: <strong>{foodMeta?.avgPrice ? `£${Math.round(foodMeta.avgPrice)}` : "Not enough data"}</strong></p>
          ) : (
            <>
              <p>Typical busy period: <strong>{nightMeta?.popularDay || peakToday || "Not enough data"}</strong></p>
              <p className="mt-1">Recent popular times: <strong>{nightMeta?.popularTimes?.length ? nightMeta.popularTimes.join(", ") : "Not enough data"}</strong></p>
            </>
          )}
          <p className="mt-2 text-xs text-neutral-500">The index is relative to other {comparisonLabel}. It is not a probability.</p>
        </div>
      )}
    </article>
  );
}
