"use client";

import React from 'react';
import VenueReportButton from './VenueReportButton';

type Props = {
  id: string;
  name: string;
  voters: number;
  heatScore: number;          // 0–100
  lat: number;
  lng: number;
  peakToday?: string | null;  // e.g. "21-22"
  dangerScore?: number; // 0-100
  price?: number | string | null;
  reportReasons?: { key: string; label: string }[];
  // Optional mode + extra metadata for expanded details
  foodMode?: boolean;
  foodMeta?: { avgPrice?: number; popularDays?: string[] };
  nightMeta?: { popularTimes?: string[]; popularDay?: string };
};

export default function VenueCard({
  id,
  name,
  voters,
  heatScore,
  lat,
  lng,
  peakToday,
  dangerScore = 0,
  price = null,
  reportReasons = undefined,
  foodMode = false,
  foodMeta,
  nightMeta,
}: Props) {
  const go = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      lat + "," + lng
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // expanded state
  const [expanded, setExpanded] = React.useState(false);

  // click/dblclick handling: use timeout to distinguish single vs double
  let clickTimer: any = null;
  const handleClick = (e: React.MouseEvent) => {
    // start a timer; if dblclick happens, it will clear this
    clickTimer = setTimeout(() => {
      setExpanded((s) => !s);
    }, 220);
  };
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    const target = foodMode ? `/food/vote?venue=${encodeURIComponent(id)}` : `/vote?venue=${encodeURIComponent(id)}`;
    window.location.href = target;
  };

  return (
    <div onClick={handleClick} onDoubleClick={handleDoubleClick} role="button" tabIndex={0} className={`rounded-xl bg-neutral-900/60 border p-4 flex flex-col gap-2 cursor-pointer ${dangerScore > 60 ? 'border-red-600' : 'border-neutral-800'}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        {price !== null && price !== undefined && (
          <div className="text-sm text-neutral-300">{
            typeof price === "number" ? (
              <span>Avg: <span className="font-medium">£{Math.round(price)}</span></span>
            ) : (
              price
            )
          }</div>
        )}
          <div className="flex items-center gap-2">
          <VenueReportButton id={id} reasons={reportReasons} />
          <button
            onClick={go}
            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm"
          >
            Navigate
          </button>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-lime-400 via-yellow-400 to-red-500"
          style={{ width: `${Math.max(0, Math.min(100, heatScore))}%` }}
        />
      </div>

      {dangerScore > 0 && (
        <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden mt-2">
          <div className="h-full bg-red-600" style={{ width: `${Math.max(0, Math.min(100, dangerScore))}%` }} />
        </div>
      )}

      <div className="text-sm text-neutral-400">
        {voters} {voters === 1 ? "vote" : "votes"}
      </div>

      <div className="text-xs text-neutral-400">
        {peakToday ? (
          <>Peak tonight: <span className="text-neutral-200 font-medium">{peakToday}</span></>
        ) : (
          <>Peak tonight: <span className="text-neutral-500">—</span></>
        )}
      </div>
      
      {/* Expanded details area */}
      {expanded && (
        <div className="mt-3 p-3 rounded bg-neutral-900/70 border border-neutral-800 text-sm text-neutral-300">
          {foodMode ? (
            <div className="space-y-2">
              <div>Average price: <span className="font-medium text-neutral-100">{foodMeta?.avgPrice ? `£${Math.round(foodMeta.avgPrice)}` : (typeof price === 'number' ? `£${Math.round(price)}` : (price ?? '—'))}</span></div>
              <div>Popular days: <span className="font-medium text-neutral-100">{(foodMeta?.popularDays && foodMeta.popularDays.length > 0) ? foodMeta.popularDays.join(', ') : '—'}</span></div>
              <div>Votes: <span className="font-medium text-neutral-100">{voters}</span></div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>Most popular day: <span className="font-medium text-neutral-100">{nightMeta?.popularDay ?? '—'}</span></div>
              <div>Popular times: <span className="font-medium text-neutral-100">{(nightMeta?.popularTimes && nightMeta.popularTimes.length > 0) ? nightMeta.popularTimes.join(', ') : '—'}</span></div>
              <div>Weekly popularity: <span className="font-medium text-neutral-100">{heatScore}%</span></div>
            </div>
          )}
          <div className="mt-2 text-xs text-neutral-500">Double-click to open vote page for this venue.</div>
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div />
        {dangerScore > 60 ? (
          <div className="text-xs text-red-300 font-semibold">Danger</div>
        ) : dangerScore > 0 ? (
          <div className="text-xs text-yellow-300">Caution</div>
        ) : null}
      </div>
    </div>
  );
}
