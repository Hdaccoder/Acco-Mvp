// src/lib/housepartyIcon.ts
import L from 'leaflet';

/**
 * Acco Houseparty icon (uses public/icon-192.png).
 * - Works on retina
 * - High zIndex
 * - Cross-origin safe
 */
export const housepartyIcon = L.icon({
  iconUrl: '/icon-192.png',       // make sure this exists in /public
  iconRetinaUrl: '/icon-512.png', // sharper on retina
  iconSize: [46, 46],
  iconAnchor: [23, 46],    // bottom-center = the point on the map
  popupAnchor: [0, -46],
  className: 'acc-house-icon',
  // @ts-ignore - Leaflet accepts crossOrigin
  crossOrigin: 'anonymous',
});
