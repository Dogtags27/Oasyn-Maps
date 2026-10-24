/**
 * map/EndpointsLayer.tsx — start and destination glyphs (R4.4).
 *
 * Draws the pulsing start dot and destination pin from the store's start/goal. Kept
 * separate from RouteLayer so endpoints persist even before a plan returns.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useStore } from "@/store";
import { startGlyph, destinationGlyph } from "./glyphs";
import { useT } from "@/i18n/useLocale";

export function EndpointsLayer() {
  const map = useMap();
  const t = useT();
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);

    if (start) {
      L.marker([start.lat, start.lng], {
        icon: L.divIcon({
          html: startGlyph(),
          className: "oasyn-glyph oasyn-glyph--start",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: t("trip.start"),
      }).addTo(group);
    }
    if (goal) {
      L.marker([goal.lat, goal.lng], {
        icon: L.divIcon({
          html: destinationGlyph(),
          className: "oasyn-glyph oasyn-glyph--goal",
          iconSize: [32, 40],
          iconAnchor: [16, 37],
        }),
        title: t("trip.destination"),
      }).addTo(group);
    }

    return () => {
      group.remove();
    };
  }, [map, start, goal, t]);

  return null;
}
