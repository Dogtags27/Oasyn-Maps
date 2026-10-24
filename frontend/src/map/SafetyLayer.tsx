/**
 * map/SafetyLayer.tsx — SIMULATED caution areas (R4.4, R16.1).
 *
 * Zones come from the scenario (dropped in the Lab or seeded by a preset). They
 * render as cross-hatched, dashed circles labelled SIMULATED and are presented
 * as generic "caution areas" — never named after real places, never described
 * as crime (R16.1). Intensity q scales the opacity only.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useStore } from "@/store";
import { useT } from "@/i18n/useLocale";
import { resolveVar } from "./ramp";

export function SafetyLayer() {
  const map = useMap();
  const t = useT();
  const zones = useStore((s) => s.scenario.zones);

  useEffect(() => {
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const plum = resolveVar("var(--plum)");

    for (const z of zones) {
      L.circle([z.center.lat, z.center.lng], {
        radius: z.r,
        color: plum,
        weight: 2,
        dashArray: "4 6",
        fillColor: plum,
        fillOpacity: 0.1 + 0.2 * z.q,
      })
        .bindTooltip(t("badge.simulated"), { permanent: false })
        .addTo(group);
    }

    return () => {
      group.remove();
    };
  }, [map, zones, t]);

  return null;
}
