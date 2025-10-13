"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VENUES, ORMSKIRK_CENTER } from "@/lib/venues";

type Props = {
  topVenueId?: string | null;
};

// Fix default marker icon paths (so markers render without bundling assets)
try {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
} catch {}

export default function MapView({ topVenueId }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <div className="h-[50vh] rounded-2xl border border-neutral-800 bg-neutral-900" />
    );

  return (
    <div className="h-[50vh] rounded-2xl overflow-hidden border border-neutral-800">
      <MapContainer
        center={[ORMSKIRK_CENTER.lat, ORMSKIRK_CENTER.lng]}
        zoom={15}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {VENUES.map((v) => {
          const isEHU = v.name.toLowerCase().includes("edge hill");
          const label = isEHU
            ? "Edge Hill University (Student Union)"
            : v.name;
          const isTop = !!topVenueId && v.id === topVenueId;

          return (
            <Marker key={v.id} position={[v.lat, v.lng]}>
              {isEHU && (
                <Tooltip permanent direction="top" offset={[0, -12]}>
                  {label}
                </Tooltip>
              )}
              {isTop && (
                <CircleMarker
                  center={[v.lat, v.lng]}
                  radius={18}
                  pathOptions={{
                    color: "#fbbf24", // amber-400
                    fillColor: "#fbbf24",
                    fillOpacity: 0.25,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -18]} permanent>
                    Hottest right now
                  </Tooltip>
                </CircleMarker>
              )}
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">
                    {label} {isTop && <span>🔥</span>}
                  </div>
                  <div className="text-neutral-500">Vote on the Vote page</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
