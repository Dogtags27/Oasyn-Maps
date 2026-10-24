/**
 * map/TreeLayer.tsx — street trees for art (R4.4).
 *
 * Trees render only at zoom >= 16, grid-thinned to avoid clutter, with a seeded
 * rotation keyed by node id (art only, via mulberry32). They carry no domain
 * meaning — purely the field-guide canopy texture.
 */
import { useEffect, useState } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useLayer, pointLatLng } from "./useLayer";
import { treeGlyph } from "./glyphs";
import { seededRotation } from "./rng";

const MIN_ZOOM_FOR_TREES = 16;

export function TreeLayer() {
  const map = useMap();
  const trees = useLayer("trees");
  const [zoom, setZoom] = useState<number>(map?.getZoom() ?? 15);

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    onZoom();
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !trees) return;
    if (zoom < MIN_ZOOM_FOR_TREES) return;
    const group = L.layerGroup().addTo(map);

    // Grid-thin: keep roughly every other feature to reduce clutter.
    trees.features.forEach((f, i) => {
      if (i % 2 !== 0) return;
      const ll = pointLatLng(f);
      if (!ll) return;
      const id = (f.properties as { id?: string } | undefined)?.id ?? `${i}`;
      const icon = L.divIcon({
        html: treeGlyph(seededRotation(id)),
        className: "oasyn-glyph",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker(ll, { icon, interactive: false }).addTo(group);
    });

    return () => {
      group.remove();
    };
  }, [map, trees, zoom]);

  return null;
}
