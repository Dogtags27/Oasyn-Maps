/**
 * map/OasisLayer.tsx — cooling centers and drinking water (R4.4).
 *
 * Renders in-house divIcon glyphs (cooling hexagon, water droplet) for the
 * cooling and water layers. Markers carry an accessible title from the feature
 * name; status is "unknown" for sample data and never presented as authoritative.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useLayer, pointLatLng } from "./useLayer";
import { coolingGlyph, waterGlyph } from "./glyphs";

function makeIcon(html: string): L.DivIcon {
  return L.divIcon({
    html,
    className: "oasyn-glyph oasyn-glyph--oasis",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function OasisLayer() {
  const map = useMap();
  const cooling = useLayer("cooling");
  const water = useLayer("water");

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);

    const add = (
      data: typeof cooling,
      glyph: string,
    ) => {
      if (!data) return;
      for (const f of data.features) {
        const ll = pointLatLng(f);
        if (!ll) continue;
        const name = (f.properties as { name?: string } | undefined)?.name;
        L.marker(ll, { icon: makeIcon(glyph), title: name, keyboard: true }).addTo(
          group,
        );
      }
    };

    add(cooling, coolingGlyph());
    add(water, waterGlyph());

    return () => {
      group.remove();
    };
  }, [map, cooling, water]);

  return null;
}
