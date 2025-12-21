// src/components/MapView.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { VENUES } from '@/lib/venues';



// ---------- Venue pin SVGs ----------
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
    className: 'acc-pin',
    html: `<img alt="" src="data:image/svg+xml;utf8,${svg}" />`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    tooltipAnchor: [12, -30],
  } as L.DivIconOptions);
}

const GOLD = svgPin('#F4C430');
const SILVER = svgPin('#C0C0C0');
const BRONZE = svgPin('#CD7F32');
const BLUE = svgPin('#3A86FF'); // for “other places”
const RED = svgPin('#FF3B30'); // for heavily reported venues

type RankMap = Record<string, 1 | 2 | 3>;
type VenueType = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  baseline?: number;
  city?: string;
};
type Tallies = Record<string, { voters: number; weighted: number; price?: number | null }>;
type Props = { ranks?: RankMap; venues?: VenueType[]; foodMode?: boolean; tallies?: Tallies; userLoc?: { lat: number; lng: number } | null; reports?: Record<string, { count: number; entries: { reason: string; createdAt: string }[] }> };

export default function MapView({ ranks = {}, venues, foodMode = false, tallies, userLoc = null, reports = {} }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const venueLayerRef = useRef<L.LayerGroup | null>(null);
  // const hpLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Use Leaflet default pin for houseparties (no asset/path issues)
  // L.Icon.Default.mergeOptions removed

  // 1) Create map once
  useEffect(() => {
    // Inject Leaflet CSS at runtime to avoid bundler/PostCSS processing of
    // node_modules CSS (which can cause PostCSS/tailwind conflicts).
    if (typeof document !== 'undefined' && !document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      link.setAttribute('data-leaflet-css', '1');
      document.head.appendChild(link);
    }
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [53.5699, -2.8823],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    venueLayerRef.current = L.layerGroup().addTo(map);
    // hpLayerRef removed

    const fix = () => { try { map.invalidateSize(); } catch {} };
    map.whenReady(fix);
    setTimeout(fix, 0);
    setTimeout(fix, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      try { venueLayerRef.current?.clearLayers(); } catch {}
      // hpLayerRef removed
      try { map.remove(); } catch {}
      mapRef.current = null;
      venueLayerRef.current = null;

    };
  }, []);
  
  // keep a ref of latest props so event handlers see current values without rebinding
  const propsRef = useRef<{ foodMode: boolean; tallies?: Tallies; userLoc?: { lat: number; lng: number } | null; reports?: Record<string, { count: number; entries: { reason: string; createdAt: string }[] }> }>({ foodMode, tallies, userLoc, reports });
  useEffect(() => {
    propsRef.current.foodMode = foodMode;
    propsRef.current.tallies = tallies;
    propsRef.current.userLoc = userLoc;
    propsRef.current.reports = reports;
  }, [foodMode, tallies, userLoc, reports]);

  // simple haversine helper for walking time
  function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const A = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(A));
  }

  // 2) Draw venue markers when ranks change
  useEffect(() => {
    const map = mapRef.current;
    const group = venueLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    (venues || VENUES).forEach((v) => {
      const r = ranks[v.id];
      const reportsFor = propsRef.current?.reports?.[v.id];
      const reportCount = reportsFor?.count ?? 0;
      // use red icon when 3 or more reports
      const icon = reportCount >= 3 ? RED : (r === 1 ? GOLD : r === 2 ? SILVER : r === 3 ? BRONZE : BLUE);

      const marker = L.marker([v.lat, v.lng], { icon, riseOnHover: true }).addTo(group);
      marker.bindTooltip(`${v.name}${rankText(r)}`, { sticky: true, direction: 'top' });

      // Larger invisible hitbox for easy taps
      L.circleMarker([v.lat, v.lng], {
        radius: 18,
        stroke: false,
        fillOpacity: 0.01,
        interactive: true,
      })
        .on('click', () => marker.fire('click'))
        .on('tap', () => marker.fire('click'))
        .addTo(group);

      // Click / double-click behavior. If in foodMode: single-click shows popup with name, avg price, walk time; double-click navigates to food vote with preselected venue.
      const isFood = !!(propsRef.current?.foodMode);
      marker.on('dblclick', () => {
        const dest = isFood ? `/food/vote?venue=${encodeURIComponent(v.id)}` : `/vote?venue=${encodeURIComponent(v.id)}`;
        window.location.href = dest;
      });
      let lastTap = 0;
      marker.on('click', () => {
        const now = Date.now();
        const wasDouble = now - lastTap < 350;
        lastTap = now;
        if (wasDouble) {
          const dest = isFood ? `/food/vote?venue=${encodeURIComponent(v.id)}` : `/vote?venue=${encodeURIComponent(v.id)}`;
          window.location.href = dest;
          return;
        }

        if (isFood) {
          // Build popup content: name, avg price (if any), walking time from user
          const talliesNow = propsRef.current?.tallies as Tallies | undefined;
          const price = talliesNow?.[v.id]?.price ?? null;
          const user = propsRef.current?.userLoc as { lat: number; lng: number } | null | undefined;
          let walkText = '';
          if (user && typeof user.lat === 'number' && typeof user.lng === 'number') {
            const d = haversineMeters(user, { lat: v.lat, lng: v.lng });
            const mins = Math.max(1, Math.round(d / 83.333)); // ~5 km/h (~3.1 mph) -> 83.333 m/min
            walkText = `${mins} min walk`;
          }
          const priceText = typeof price === 'number' ? `Avg: £${Math.round(price)}` : '';
          const parts = [escapeHtml(v.name), priceText, walkText].filter(Boolean);
          let html = `<div style="min-width:140px">${parts.map(p => `<div>${escapeHtml(p)}</div>`).join('')}</div>`;
          if (reportCount >= 1) {
            const entries = propsRef.current?.reports?.[v.id]?.entries || [];
            const repHtml = `<div style="margin-top:8px"><strong style="color:#ff3b30">Reports (${entries.length}):</strong><ul style="margin:6px 0 0 14px;padding:0">${entries.map(e=>`<li>${escapeHtml(e.reason)} ${e.createdAt?`(${escapeHtml(e.createdAt)})`:''}</li>`).join('')}</ul></div>`;
            html = html.replace('</div>', `${repHtml}</div>`);
          }
          marker.bindPopup(html, { offset: [0, -10] }).openPopup();
        } else {
          // Non-food: no popup on single click (tooltip exists). Keep behavior as before.
        }
      });
    });
  }, [ranks, venues, foodMode]);

  



  return (
    <>
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-neutral-800"
        style={{ height: 420, width: '100%' }}
        aria-label="Live map of Ormskirk venues and houseparties"
      />
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
        <LegendSwatch color="#F4C430" label="Hottest" />
        <LegendSwatch color="#C0C0C0" label="2nd" />
        <LegendSwatch color="#CD7F32" label="3rd" />
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-400" />
          Other places
        </span>

      </div>
    </>
  );
}

// helpers
function rankText(rank?: 1 | 2 | 3) {
  if (rank === 1) return ' — Hottest right now';
  if (rank === 2) return ' — 2nd hottest';
  if (rank === 3) return ' — 3rd hottest';
  return '';
}
function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return c;
    }
  });
}
