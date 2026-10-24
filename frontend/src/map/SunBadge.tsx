/**
 * map/SunBadge.tsx — a corner sun badge rotated to the azimuth (R4.4).
 *
 * Shows the sun octagon rotated to the current azimuth with the elevation in
 * mono. Position is display-only (see sun.ts). It sits in the map corner rather
 * than as a map marker so it stays visible regardless of pan.
 */
import { useMemo } from "react";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { sunPosition } from "./sun";
import { sunBadgeGlyph } from "./glyphs";

export function SunBadge() {
  const timeISO = useStore((s) => s.scenario.timeISO);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);

  const pos = useMemo(
    () => sunPosition(new Date(timeISO), cfg.center.lat, cfg.center.lon),
    [timeISO, cfg.center.lat, cfg.center.lon],
  );

  const elevation = Math.round(pos.elevation);

  return (
    <div className="sun-badge" aria-hidden="true">
      <span
        className="sun-badge__glyph"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sunBadgeGlyph(pos.azimuth) }}
      />
      <span className="sun-badge__elev mono">{elevation}&deg;</span>
    </div>
  );
}
