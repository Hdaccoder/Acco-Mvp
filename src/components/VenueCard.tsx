// src/components/VenueCard.tsx
"use client";

import Link from "next/link";
import { MouseEvent, useMemo } from "react";

type Props = {
  id: string;
  name: string;
  voters: number;
  heatScore: number; // 0..100
  lat: number;       // ⬅️ new
  lng: number;       // ⬅️ new
  peakWindow?: string | undefined;
};

export default function VenueCard({
  id,
  name,
  voters,
  heatScore,
  lat,
  lng,
  peakWindow,
}: Props) {
  const mapsUrl = useMemo(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isApple = /iPhone|iPad|Macintosh/i.test(ua);
    return isApple
      ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
  }, [lat, lng]);

  function openNav(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }

  const clamped = Math.max(0, Math.min(100, heatScore));

  return (
    <Link
      href={`/vote?venue=${encodeURIComponent(id)}`}
      className="block rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors"
    >
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">{name}</div>
          <button
            onClick={openNav}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-neutral-700 text-sm hover:bg-neutral-800"
            title="Navigate"
          >
            Navigate
          </button>
        </div>

        {peakWindow && (
          <div className="text-xs text-neutral-400">~{peakWindow}</div>
        )}

        <div className="h-2 rounded bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600"
            style={{ width: `${clamped}%` }}
          />
        </div>

        <div className="text-xs text-neutral-400">
          {voters} {voters === 1 ? "vote" : "votes"}
        </div>
      </div>
    </Link>
  );
}
