"use client";

import Link from "next/link";

type Props = {
  id: string;
  name: string;
  voters: number;
  heatScore: number; // 0..100
  peakWindow?: string | undefined;
};

export default function VenueCard({
  id,
  name,
  voters,
  heatScore,
  peakWindow,
}: Props) {
  return (
    <Link
      href={`/vote?venue=${encodeURIComponent(id)}`}
      className="block rounded-2xl border border-neutral-800 hover:border-neutral-700 transition-colors"
    >
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">{name}</div>
          {peakWindow && (
            <div className="text-xs text-neutral-400">~{peakWindow}</div>
          )}
        </div>

        {/* Heat bar */}
        <div className="h-2 rounded bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600"
            style={{ width: `${Math.max(0, Math.min(100, heatScore))}%` }}
          />
        </div>

        <div className="text-xs text-neutral-400">
          {voters} {voters === 1 ? "vote" : "votes"}
        </div>
      </div>
    </Link>
  );
}
