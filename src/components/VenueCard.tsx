"use client";

type Props = {
  id: string;
  name: string;
  voters: number;
  heatScore: number;          // 0–100
  lat: number;
  lng: number;
  peakToday?: string | null;  // e.g. "21-22"
};

export default function VenueCard({
  id,
  name,
  voters,
  heatScore,
  lat,
  lng,
  peakToday,
}: Props) {
  const go = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      lat + "," + lng
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        <button
          onClick={go}
          className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm"
        >
          Navigate
        </button>
      </div>

      <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-lime-400 via-yellow-400 to-red-500"
          style={{ width: `${Math.max(0, Math.min(100, heatScore))}%` }}
        />
      </div>

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
    </div>
  );
}
