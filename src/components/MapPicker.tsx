'use client';

import { useEffect, useRef } from 'react';
import L, { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { housepartyDivIcon } from '@/lib/housepartyMarker';

import 'leaflet/dist/leaflet.css';

type Props = {
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  className?: string;
  height?: number; // px
};

export default function MapPicker({ value, onChange, className, height = 280 }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  // Use Leaflet's default marker (CDN paths avoid bundler issues)
  // Do this once at module scope or inside first effect before creating markers.
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  // Initialize map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const initial = value ?? { lat: 53.569, lng: -2.881 }; // Ormskirk default

    const map = L.map(mapEl.current, {
      center: initial,
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Default Leaflet marker (draggable)
    const marker = L.marker(initial, { draggable: true, icon: housepartyDivIcon(34) }).addTo(map);
    marker.setZIndexOffset(2000); // keep above tiles/controls
    markerRef.current = marker;

    const commit = (latlng: L.LatLng) => onChange({ lat: latlng.lat, lng: latlng.lng });

    marker.on('dragend', () => commit(marker.getLatLng()));
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      commit(e.latlng);
    });

    // Ensure proper sizing after mount
    const invalidate = () => { try { map.invalidateSize(); } catch {} };
    map.whenReady(invalidate);
    setTimeout(invalidate, 100);
    setTimeout(invalidate, 300);

    // Cleanup on unmount
    return () => {
      try { map.remove(); } catch {}
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

