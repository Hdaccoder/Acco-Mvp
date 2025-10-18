// src/components/MapView.tsx
"use client";

import { useEffect, useRef, useId } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VENUES } from "@/lib/venues";

// --- Icons (SVG generator) ---------------------------------------------------
function svgPin(color: string): L.DivIcon {
  const svg = encodeURIComponent(`
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/></filter></defs>
      <g filter="url(#s)">
        <path fill="${color}" stroke="#333" stroke-width="1"
          d="M12.5 1c-6.1 0-11 4.86-11 10.86 0 5.37 8.08 16.2 10.4 19.23.31.41.9.41 1.2 0 2.32-3.03 10.4-13.86 10.4-19.23C23.5 5.86 18.6 1 12.5 1z"/>
        <circle cx="12.5" cy="12" r="4.5" fill="#fff" stroke="#333" stroke-width="1"/>
      </g>
    </svg>
  `);

  return L.divIcon({
    className: "acc-pin",
    html: `<img alt="" src="data:image/svg+xml;utf8,${svg}" />`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    tooltipAnchor: [12, -30],
  } as L.DivIconOptions);
}

const GOLD   = svgPin("#F4C430");
const SILVER = svgPin("#C0C0C0");
const BRONZE = svgPin("#CD7F32");
const BLUE   = svgPin("#3A86FF");

// --- Types -------------------------------------------------------------------
type RankMap = Record<string, 1 | 2 | 3>;

type Props = {
  /** venueId -> 1 | 2 | 3 for gold/silver/bronze */
  ranks?: RankMap;
};

// --- Helpers -----------------------------------------------------------------
function rankLabel(rank?: 1 | 2 | 3) {
  if (rank === 1) return " — Hottest right now";
  if (rank === 2) return " — 2nd hottest";
  if (rank === 3) return " — 3rd hottest";
  return "";
}

// --- Component ---------------------------------------------------------------
export default function MapView({ ranks = {} }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Tear down old map if re-rendered with new props
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {}
      mapRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    // Create map
    const map = L.map(containerRef.current as HTMLDivElement, {
      center: [53.5699, -2.8823], // Ormskirk approx
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    // Tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Marker layer
    const group = L.layerGroup().addTo(map);
    layerGroupRef.current = group;

    // Add markers with tooltips + larger tap hitbox
    VENUES.forEach((v) => {
      const r = ranks[v.id];
      const icon = r === 1 ? GOLD : r === 2 ? SILVER : r === 3 ? BRONZE : BLUE;

      const marker = L.marker([v.lat, v.lng], { icon, riseOnHover: true }).addTo(group);
      marker.bindTooltip(`${v.name}${rankLabel(r)}`, {
        sticky: true,
        permanent: false,
        direction: "top",
      });

      // Larger tap/click hitbox around the marker for mobile
      const hitbox = L.circleMarker([v.lat, v.lng], {
        radius: 18,
        stroke: false,
        fillOpacity: 0.01, // capture events but invisible
        interactive: true,
      })
        .on("click", () => marker.fire("click"))
        .on("tap", () => marker.fire("click"))
        .addTo(group);

      marker.setZIndexOffset(2000);
      (hitbox as any).setZIndex?.(1000);

      // Double click / double tap => vote with pre-selected venue
      marker.on("dblclick", () => {
        window.location.href = `/vote?venue=${encodeURIComponent(v.id)}`;
      });
      let lastTap = 0;
      marker.on("click", () => {
        const now = Date.now();
        if (now - lastTap < 350) {
          window.location.href = `/vote?venue=${encodeURIComponent(v.id)}`;
        }
        lastTap = now;
      });
    });

    // Fix sizing after mount
    const resize = () => {
      try {
        map.invalidateSize();
      } catch {}
    };
    map.whenReady(resize);
    setTimeout(resize, 0);
    setTimeout(resize, 200);

    // Cleanup
    return () => {
      try {
        if (layerGroupRef.current) {
          layerGroupRef.current.clearLayers();
          layerGroupRef.current = null;
        }
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {}
    };
  }, [ranks]);

  return (
    <>
      <div
        id={containerId}
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-neutral-800"
        style={{ height: 420, width: "100%" }}
        aria-label="Live map of Ormskirk venues"
      />
      {/* Tiny legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#F4C430" }} />
          Hottest
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#C0C0C0" }} />
          2nd
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#CD7F32" }} />
          3rd
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-400" />
          Other places
        </span>
      </div>
    </>
  );
}
