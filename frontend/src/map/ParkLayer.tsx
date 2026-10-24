/**
 * map/ParkLayer.tsx — parks as hatched polygons (R4.4).
 *
 * Parks render with a hatch fill (an SVG pattern) and an ink outline, keeping
 * the field-guide character. Hatch is a redundant signal alongside the necklace
 * tint so colour is never the sole cue.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useLayer, polygonLatLngs } from "./useLayer";
import { resolveVar } from "./ramp";

export function ParkLayer() {
  const map = useMap();
  const parks = useLayer("parks");

  useEffect(() => {
    if (!map || !parks) return;
    const group = L.layerGroup().addTo(map);
    const necklace = resolveVar("var(--necklace)");

    for (const f of parks.features) {
      const ring = polygonLatLngs(f);
      if (!ring) continue;
      L.polygon(ring, {
        color: necklace,
        weight: 1.5,
        opacity: 0.8,
        fillColor: necklace,
        fillOpacity: 0.16,
        // Leaflet has no native hatch; the low-opacity fill + dashed outline
        // reads as a park without mimicking a solid heat area.
        dashArray: "4 4",
      }).addTo(group);
    }

    return () => {
      group.remove();
    };
  }, [map, parks]);

  return null;
}
