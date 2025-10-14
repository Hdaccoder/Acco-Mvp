// src/components/MapView.tsx
"use client";

import { MapContainer, TileLayer, Marker, Tooltip, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { VENUES } from "@/lib/venues";
import { useMemo } from "react";

// Simple Leaflet default marker fix (only if you had custom icons you can keep them)
import L from "leaflet";
const DefaultIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type Props = {
  // podiumIds[0] = gold (most votes)
  // podiumIds[1] = silver
  // podiumIds[2] = bronze
  podiumIds?: string[];
};

export default function MapView({ podiumIds = [] }: Props) {
  // Center map roughly on Ormskirk
  const center = useMemo<[number, number]>(() => {
    // average of all venue coords for a nice fit
    const lat =
      VENUES.reduce((s, v) => s + v.lat, 0) / Math.max(1, VENUES.length);
    const lng =
      VENUES.reduce((s, v) => s + v.lng, 0) / Math.max(1, VENUES.length);
    return [lat, lng];
  }, []);

  const goldId = podiumIds[0] || null;
  const silverId = podiumIds[1] || null;
  const bronzeId = podiumIds[2] || null;

  return (
    <div className="rounded-2xl overflow-hidden border border-neutral-800">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: 420, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {VENUES.map((v) => {
          const isGold = v.id === goldId;
          const isSilver = v.id === silverId;
          const isBronze = v.id === bronzeId;

          // A soft colored glow under the pin
          const circles = [
            isGold && {
              color: "#f59e0b", // amber-500
              fillColor: "#fbbf24", // amber-400
              tooltip: "Hottest right now",
            },
            isSilver && {
              color: "#cbd5e1", // slate-300 (silver-ish)
              fillColor: "#e5e7eb", // gray-200
              tooltip: "2nd hottest",
            },
            isBronze && {
              color: "#b45309", // orange-700 (bronze-ish)
              fillColor: "#f59e0b", // amber-500
              tooltip: "3rd hottest",
            },
          ].filter(Boolean) as Array<{
            color: string;
            fillColor: string;
            tooltip: string;
          }>;

          return (
            <div key={v.id}>
              {circles.map((c, i) => (
                <Circle
                  key={`${v.id}-c${i}`}
                  center={[v.lat, v.lng]}
                  radius={90}
                  pathOptions={{
                    color: c.color,
                    fillColor: c.fillColor,
                    fillOpacity: 0.35,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                    {c.tooltip}
                  </Tooltip>
                </Circle>
              ))}

              <Marker position={[v.lat, v.lng]}>
                <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                  {v.name}
                </Tooltip>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
