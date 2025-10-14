"use client";

import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { VENUES } from "@/lib/venues";
import { useMemo } from "react";
import L, { Icon } from "leaflet";

type Props = {
  // podiumIds[0] = gold (most votes)
  // podiumIds[1] = silver
  // podiumIds[2] = bronze
  podiumIds?: string[];
};

// Helper to make a colored SVG “pin” icon as a data URI
function makePin(fill: string, stroke: string): Icon {
  const svg = encodeURIComponent(`
    <svg viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.35"/>
        </filter>
      </defs>
      <!-- pin -->
      <path filter="url(#shadow)"
        d="M16 2c-7.18 0-13 5.82-13 13 0 9.75 13 23 13 23s13-13.25 13-23c0-7.18-5.82-13-13-13z"
        fill="${fill}" stroke="${stroke}" stroke-width="2" />
      <!-- inner dot -->
      <circle cx="16" cy="15" r="5.4" fill="#ffffff" opacity="0.9"/>
    </svg>
  `);

  return L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${svg}`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
    tooltipAnchor: [0, -30],
  });
}

// Prebuild icons for performance
const ICONS = {
  gold: makePin("#f59e0b", "#d97706"),   // amber-500 / amber-600
  silver: makePin("#9ca3af", "#6b7280"), // gray-400 / gray-500
  bronze: makePin("#b45309", "#92400e"), // orange-700 / orange-800
  blue: makePin("#3b82f6", "#1d4ed8"),   // blue-500 / blue-700 (default)
};

export default function MapView({ podiumIds = [] }: Props) {
  const center = useMemo<[number, number]>(() => {
    const lat =
      VENUES.reduce((s, v) => s + v.lat, 0) / Math.max(1, VENUES.length);
    const lng =
      VENUES.reduce((s, v) => s + v.lng, 0) / Math.max(1, VENUES.length);
    return [lat, lng];
  }, []);

  const goldId = podiumIds[0] || null;
  const silverId = podiumIds[1] || null;
  const bronzeId = podiumIds[2] || null;

  const iconFor = (venueId: string) => {
    if (venueId === goldId) return ICONS.gold;
    if (venueId === silverId) return ICONS.silver;
    if (venueId === bronzeId) return ICONS.bronze;
    return ICONS.blue;
  };

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

        {VENUES.map((v) => (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={iconFor(v.id)}>
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              {v.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
