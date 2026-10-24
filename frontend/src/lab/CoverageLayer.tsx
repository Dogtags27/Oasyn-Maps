/**
 * lab/CoverageLayer.tsx — the Cooling-access map overlay.
 *
 * Draws each sampled walking time to the nearest cooling spot as a dot coloured
 * by band (under 5 / 5 to 10 / over 10 minutes, matching the text legend so
 * colour is never the sole signal), and each suggested new site as a numbered
 * star pin. Fits the view to the data. Colours come from theme tokens.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "@/map/MapContext";
import { resolveVar } from "@/map/ramp";
import type { CoverageResponseT } from "@/api/types";

const NEAR_MIN = 5;
const FAR_MIN = 10;

function suggestionIcon(rank: number): L.DivIcon {
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40" aria-hidden="true" focusable="false">
    <ellipse cx="17" cy="38" rx="5" ry="1.6" fill="var(--route-shadow)" />
    <path d="M17 37s-12-10.5-12-20a12 12 0 0 1 24 0c0 9.5-12 20-12 20z" fill="var(--violet)" stroke="var(--paper)" stroke-width="2" />
    <text x="17" y="21.5" text-anchor="middle" font-size="12" font-weight="800" fill="var(--on-color)" font-family="system-ui, sans-serif">${rank}</text>
  </svg>`;
  return L.divIcon({
    html,
    className: "oasyn-glyph oasyn-glyph--goal",
    iconSize: [34, 40],
    iconAnchor: [17, 37],
  });
}

export function CoverageLayer({
  samples,
  suggestions,
}: {
  samples: CoverageResponseT["samples"];
  suggestions: CoverageResponseT["suggestions"];
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const near = resolveVar("var(--necklace)");
    const mid = resolveVar("var(--amber)");
    const far = resolveVar("var(--brick)");
    const ring = resolveVar("var(--paper)");
    const pts: [number, number][] = [];
    for (const s of samples) {
      const color = s.minutes < NEAR_MIN ? near : s.minutes <= FAR_MIN ? mid : far;
      L.circleMarker([s.at.lat, s.at.lng], {
        radius: 9,
        color: ring,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95,
        className: "oasyn-route",
      }).addTo(group);
      pts.push([s.at.lat, s.at.lng]);
    }
    suggestions.forEach((s, i) => {
      L.marker([s.at.lat, s.at.lng], { icon: suggestionIcon(i + 1), interactive: false }).addTo(group);
      pts.push([s.at.lat, s.at.lng]);
    });
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], 15);
    return () => {
      group.remove();
    };
  }, [map, samples, suggestions]);
  return null;
}
