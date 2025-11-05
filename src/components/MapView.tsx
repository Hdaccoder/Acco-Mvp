// src/components/MapView.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VENUES } from '@/lib/venues';
import { housepartyDivIcon } from '@/lib/housepartyMarker';


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

type RankMap = Record<string, 1 | 2 | 3>;
type Props = { ranks?: RankMap };

export default function MapView({ ranks = {} }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const venueLayerRef = useRef<L.LayerGroup | null>(null);
  const hpLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Use Leaflet default pin for houseparties (no asset/path issues)
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  // 1) Create map once
  useEffect(() => {
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
    hpLayerRef.current = L.layerGroup().addTo(map);

    const fix = () => { try { map.invalidateSize(); } catch {} };
    map.whenReady(fix);
    setTimeout(fix, 0);
    setTimeout(fix, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      try { venueLayerRef.current?.clearLayers(); } catch {}
      try { hpLayerRef.current?.clearLayers(); } catch {}
      try { map.remove(); } catch {}
      mapRef.current = null;
      venueLayerRef.current = null;
      hpLayerRef.current = null;
    };
  }, []);

  // 2) Draw venue markers when ranks change
  useEffect(() => {
    const map = mapRef.current;
    const group = venueLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    VENUES.forEach((v) => {
      const r = ranks[v.id];
      const icon = r === 1 ? GOLD : r === 2 ? SILVER : r === 3 ? BRONZE : BLUE;

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

      // Double-click/tap to vote
      marker.on('dblclick', () => {
        window.location.href = `/vote?venue=${encodeURIComponent(v.id)}`;
      });
      let lastTap = 0;
      marker.on('click', () => {
        const now = Date.now();
        if (now - lastTap < 350) {
          window.location.href = `/vote?venue=${encodeURIComponent(v.id)}`;
        }
        lastTap = now;
      });
    });
  }, [ranks]);

  // 3) Poll API for tonight's houseparties and draw markers
  useEffect(() => {
    const group = hpLayerRef.current;
    if (!group) return;

    const load = async () => {
      try {
        const res = await fetch('/api/houseparty/tonight', { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const { items } = (await res.json()) as { items: any[] };

        group.clearLayers();

        items.forEach((hp) => {
          if (!hp?.location?.lat || !hp?.location?.lng) return;

          const m = L.marker([hp.location.lat, hp.location.lng], { icon: housepartyDivIcon(28) }).addTo(group);
          m.setZIndexOffset(2000);
          const html = `
            <div style="color:#000;">
              <strong>${escapeHtml(hp.name ?? 'Houseparty')}</strong><br/>
              ${hp.kind ? `<em>${escapeHtml(hp.kind)}</em><br/>` : ''}
              ${hp.address ? `${escapeHtml(hp.address)}<br/>` : ''}
              ${hp.notes ? `<small>${escapeHtml(hp.notes)}</small>` : ''}
            </div>
          `;
          m.bindPopup(html);
        });
      } catch (e) {
        // fail silently (keeps map usable if offline)
        console.warn('Failed to load houseparties', e);
      }
    };

    load(); // initial
    pollRef.current = setInterval(load, 20000); // every 20s

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#F4C430', boxShadow: '0 0 6px rgba(255,215,0,.7)' }} />
          Houseparty
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
