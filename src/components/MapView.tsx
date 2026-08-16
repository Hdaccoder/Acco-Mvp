"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

type RankMap = Record<string, 1 | 2 | 3>;
type Venue = { id: string; name: string; lat: number; lng: number; city?: string };
type Tallies = Record<string, { voters: number; weighted: number; price?: number | null }>;
type Reports = Record<string, { count: number; entries: unknown[] }>;
type Props = {
  ranks?: RankMap;
  venues?: Venue[];
  foodMode?: boolean;
  tallies?: Tallies;
  userLoc?: { lat: number; lng: number } | null;
  reports?: Reports;
};

function svgPin(color: string) {
  const svg = encodeURIComponent(`<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" stroke="#111" stroke-width="1.5" d="M12.5 1c-6.1 0-11 4.86-11 10.86 0 5.37 8.08 16.2 10.4 19.23.31.41.9.41 1.2 0 2.32-3.03 10.4-13.86 10.4-19.23C23.5 5.86 18.6 1 12.5 1z"/><circle cx="12.5" cy="12" r="4.5" fill="#fff" stroke="#111"/></svg>`);
  return L.divIcon({ className: "acco-pin", html: `<img alt="" src="data:image/svg+xml;utf8,${svg}">`, iconSize: [25, 41], iconAnchor: [12, 41], tooltipAnchor: [12, -30] });
}

const icons = {
  gold: svgPin("#F4C430"),
  silver: svgPin("#C0C0C0"),
  bronze: svgPin("#CD7F32"),
  blue: svgPin("#3A86FF"),
  red: svgPin("#FF3B30"),
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function rankLabel(rank?: 1 | 2 | 3) {
  if (rank === 1) return "Ranked first";
  if (rank === 2) return "Ranked second";
  if (rank === 3) return "Ranked third";
  return "Other listed place";
}

export default function MapView({ ranks = {}, venues = [], foodMode = false, tallies = {}, userLoc = null, reports = {} }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [53.5699, -2.8823], zoom: 13, zoomControl: true, attributionControl: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      layerRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    venues.forEach((venue) => {
      const rank = ranks[venue.id];
      const reportCount = reports[venue.id]?.count || 0;
      const icon = reportCount >= 3 ? icons.red : rank === 1 ? icons.gold : rank === 2 ? icons.silver : rank === 3 ? icons.bronze : icons.blue;
      const marker = L.marker([venue.lat, venue.lng], { icon, riseOnHover: true, title: `${venue.name}. ${rankLabel(rank)}` }).addTo(layer);
      const tally = tallies[venue.id];
      const voteHref = foodMode ? `/food/vote?venue=${encodeURIComponent(venue.id)}` : `/vote?venue=${encodeURIComponent(venue.id)}`;
      const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
      const reportText = reportCount ? `<p style="color:#b91c1c">${reportCount} safety ${reportCount === 1 ? "report" : "reports"} today</p>` : "";
      const priceText = tally?.price != null ? `<p>Average £${Math.round(tally.price)}</p>` : "";
      marker.bindTooltip(`${escapeHtml(venue.name)} · ${rankLabel(rank)}`, { sticky: true, direction: "top" });
      marker.bindPopup(`<div style="min-width:170px"><strong>${escapeHtml(venue.name)}</strong><p>${tally?.voters || 0} live votes</p>${priceText}${reportText}<p style="margin-top:8px"><a href="${voteHref}">Vote here</a> · <a href="${directionsHref}" target="_blank" rel="noopener">Directions</a></p></div>`);
      bounds.push([venue.lat, venue.lng]);
    });

    if (userLoc) {
      L.circleMarker([userLoc.lat, userLoc.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }).bindTooltip("Your approximate location").addTo(layer);
      bounds.push([userLoc.lat, userLoc.lng]);
    }
    if (bounds.length === 1) map.setView(bounds[0], 14);
    else if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 15 });
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [foodMode, ranks, reports, tallies, userLoc, venues]);

  return (
    <div>
      <div ref={containerRef} className="h-[420px] min-h-[420px] w-full overflow-hidden rounded-2xl border border-neutral-800" role="region" aria-label="Interactive map of local venues" />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-400" aria-label="Map legend">
        <Legend color="#F4C430" label="Ranked first" />
        <Legend color="#C0C0C0" label="Ranked second" />
        <Legend color="#CD7F32" label="Ranked third" />
        <Legend color="#3A86FF" label="Other places" />
        <Legend color="#FF3B30" label="Several safety reports" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: color }} aria-hidden="true" />{label}</span>;
}
