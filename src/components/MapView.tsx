"use client";

import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { VENUES } from "@/lib/venues";
import { useMemo, useRef } from "react";
import L, { Icon } from "leaflet";
import { useRouter } from "next/navigation";

type Props = {
  // podiumIds[0] = gold, [1] = silver, [2] = bronze
  podiumIds?: string[];
};

function makePin(fill: string, stroke: string): Icon {
  const svg = encodeURIComponent(`
    <svg viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path filter="url(#shadow)"
        d="M16 2c-7.18 0-13 5.82-13 13 0 9.75 13 23 13 23s13-13.25 13-23c0-7.18-5.82-13-13-13z"
        fill="${fill}" stroke="${stroke}" stroke-width="2" />
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

const ICONS = {
  gold: makePin("#f59e0b", "#d97706"),
  silver: makePin("#9ca3af", "#6b7280"),
  bronze: makePin("#b45309", "#92400e"),
  blue: makePin("#3b82f6", "#1d4ed8"),
};

export default function MapView({ podiumIds = [] }: Props) {
  const router = useRouter();
  const lastTapRef = useRef<number>(0);

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

  const suffixFor = (venueId: string) => {
    if (venueId === goldId) return " — Hottest right now";
    if (venueId === silverId) return " — 2nd hottest";
    if (venueId === bronzeId) return " — 3rd hottest";
    return "";
  };

  const goVoteFor = (venueId: string) => {
    router.push(`/vote?venue=${encodeURIComponent(venueId)}`);
  };

  // Double-tap detector for touch devices (350ms window)
  const handleTap = (venueId: string) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      goVoteFor(venueId);
    }
    lastTapRef.current = now;
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
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {VENUES.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={iconFor(v.id)}
            eventHandlers={{
              // Desktop double-click
              dblclick: () => goVoteFor(v.id),
              // Mobile double-tap (two quick taps)
              click: () => handleTap(v.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              {v.name}
              {suffixFor(v.id)}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
