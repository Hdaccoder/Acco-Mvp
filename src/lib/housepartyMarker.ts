// src/lib/housepartyMarker.ts
import * as L from "leaflet";

/**
 * Brand-aligned "houseparty" pin as a DivIcon.
 * • No external assets
 * • Bottom-center anchor (no visual drift)
 * • Soft glow (no scale) to avoid offset changes
 */
export function housepartyDivIcon(size = 36) {
  // Total height includes the pin "point"
  const pinH = Math.round(size + size * 0.28); // ~28% tail
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = rOuter - 3;

  const svg = encodeURIComponent(`
    <svg width="${size}" height="${pinH}" viewBox="0 0 ${size} ${pinH}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="hpShadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/></filter>
      </defs>

      <!-- Gold pin with tail -->
      <g filter="url(#hpShadow)">
        <path d="
          M ${cx} 1
          a ${rOuter} ${rOuter} 0 1 1 0 ${size}
          L ${cx} ${pinH}
          Z
        " fill="#F4C430" stroke="#1f2937" stroke-width="1"/>
      </g>

      <!-- Inner dark disc with white ring -->
      <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#111827" stroke="#ffffff" stroke-width="2" opacity="0.95"/>

      <!-- Minimal house glyph -->
      <g transform="translate(${cx - size * 0.17}, ${cy - size * 0.14})" fill="#ffffff">
        <path d="M 0 ${size*0.14} L ${size*0.17} 0 L ${size*0.34} ${size*0.14} Z"/>
        <rect x="0" y="${size*0.14}" width="${size*0.34}" height="${size*0.28}" rx="2"/>
        <rect x="${size*0.14}" y="${size*0.26}" width="${size*0.07}" height="${size*0.16}" rx="1" fill="#111827"/>
      </g>
    </svg>
  `);

  return L.divIcon({
    className: "hp-pin", // styled in globals.css
    html: `<img alt="" src="data:image/svg+xml;utf8,${svg}" />`,
    iconSize: [size, pinH],
    // 👇 bottom-center = the exact map point
    iconAnchor: [Math.round(size / 2), pinH],
    popupAnchor: [0, -pinH],
  } as L.DivIconOptions);
}
