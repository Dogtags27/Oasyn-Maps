/**
 * map/WalkerLayer.tsx — the playback walker marker (R7.2).
 *
 * Draws the walker glyph at the interpolated position along the selected route.
 * Position comes from the shared walker progress; no recompute.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useStore, useSelectedRoute } from "@/store";
import { positionAt } from "@/lab/playback";
import { walkerGlyph } from "./glyphs";
import { useT } from "@/i18n/useLocale";

export function WalkerLayer() {
  const map = useMap();
  const t = useT();
  const route = useSelectedRoute();
  const progress = useStore((s) => s.progress);

  useEffect(() => {
    if (!map || !route) return;
    const pos = positionAt(route, progress);
    if (!pos) return;
    const marker = L.marker([pos.lat, pos.lng], {
      icon: L.divIcon({
        html: walkerGlyph(),
        className: "oasyn-glyph oasyn-glyph--walker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      title: t("lab.playback"),
      interactive: false,
    }).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, route, progress, t]);

  return null;
}
