"use client";

import { useEffect, useRef } from 'react';


// Inject Leaflet CSS at runtime to avoid PostCSS processing of node_modules CSS
if (typeof document !== 'undefined' && !document.querySelector('link[data-leaflet-css]')) {
  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  link.setAttribute('data-leaflet-css', '1');
  document.head.appendChild(link);
}

type Props = {
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  className?: string;
  height?: number; // px
};

export default function MapPicker({ value, onChange, className, height = 280 }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const markerRef = useRef<any | null>(null);

  // Leaflet is dynamically imported on the client to avoid server-side evaluation

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const initial = value ?? { lat: 53.569, lng: -2.881 }; // Ormskirk default

    (async () => {
      const leaflet: any = await import('leaflet');

      // Use Leaflet's default marker with CDN image paths
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = leaflet.map(mapEl.current, {
        center: initial,
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Default Leaflet marker (draggable)
      const marker = leaflet.marker(initial, { draggable: true }).addTo(map);
      marker.setZIndexOffset(2000); // keep above tiles/controls
      markerRef.current = marker;

      const commit = (latlng: any) => onChange({ lat: latlng.lat, lng: latlng.lng });

      marker.on('dragend', () => commit(marker.getLatLng()));
      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        commit(e.latlng);
      });
    })();

    // Ensure proper sizing after mount
    const invalidate = () => { try { mapRef.current?.invalidateSize(); } catch {} };
    mapRef.current?.whenReady?.(invalidate);
    setTimeout(invalidate, 100);
    setTimeout(invalidate, 300);

    // Cleanup on unmount
    return () => {
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [onChange]);

  // Keep marker synced if parent provides a new value
  useEffect(() => {
    if (markerRef.current && value) {
      markerRef.current.setLatLng(value);
      mapRef.current?.panTo(value);
    }
  }, [value]);

  return (
    <div
      ref={mapEl}
      className={className}
      style={{
        height,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      aria-label="Pick location on map"
    />
  );
}

