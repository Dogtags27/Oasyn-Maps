/**
 * map/RouteLayer.tsx — route rendering (R4.2, R4.3, R16.4).
 *
 * Selected route: a 2px ink casing under a 7px colour line, drawn per segment
 * with the colour from the config ramp; high-heat segments also get a redundant
 * paper tick overlay (colour is never the sole signal). Alternatives render in
 * ink-2, dashed, 60% opacity. Exposure per segment is sampled from the route's
 * aTrace — the frontend never recomputes it.
 */
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import type { RouteResultT, LatLngT } from "@/api/types";
import { rampBand, bandColorVar, resolveVar, isHighHeat } from "./ramp";

/** Exposure A at a fractional position along the route, from aTrace. */
function exposureAlong(route: RouteResultT, frac: number): number {
  const trace = route.aTrace;
  if (trace.length === 0) return 0;
  const idx = Math.min(trace.length - 1, Math.floor(frac * (trace.length - 1)));
  return trace[idx][2];
}

function toLatLng(p: LatLngT): [number, number] {
  return [p.lat, p.lng];
}

export function RouteLayer() {
  const map = useMap();
  const routes = useStore((s) => s.routes);
  const selectedId = useStore((s) => s.selectedId);
  const config = useStore((s) => s.config);
  const sunMode = useStore((s) => s.sunMode);

  useEffect(() => {
    if (!map) return;
    const cfg = viewConfig(config);
    const group = L.layerGroup().addTo(map);

    const inkColor = resolveVar("var(--ink)");
    const ink2Color = resolveVar("var(--ink-2)");
    const paperColor = resolveVar("var(--paper)");

    // Draw alternatives first so the selected route sits on top.
    for (const route of routes) {
      if (route.id === selectedId) continue;
      L.polyline(route.geometry.map(toLatLng), {
        color: ink2Color,
        weight: 4,
        opacity: 0.6,
        dashArray: "6 8",
      }).addTo(group);
    }

    const selected = routes.find((r) => r.id === selectedId);
    if (selected && selected.geometry.length >= 2) {
      const pts = selected.geometry;
      // Ink casing under the whole route.
      L.polyline(pts.map(toLatLng), {
        color: inkColor,
        weight: 11,
        opacity: 1,
      }).addTo(group);

      // Per-segment colour line.
      for (let i = 0; i < pts.length - 1; i++) {
        const frac = i / Math.max(1, pts.length - 2);
        const a = exposureAlong(selected, frac);
        const band = rampBand(a, cfg.bands);
        const color = resolveVar(bandColorVar(band));
        const seg: [number, number][] = [toLatLng(pts[i]), toLatLng(pts[i + 1])];
        L.polyline(seg, { color, weight: 7, opacity: 1 }).addTo(group);

        // Redundant paper tick overlay on high-heat segments (R16.4).
        if (isHighHeat(a, cfg.bands)) {
          L.polyline(seg, {
            color: paperColor,
            weight: 7,
            opacity: 1,
            dashArray: "2 10",
          }).addTo(group);
        }
      }
    }

    return () => {
      group.remove();
    };
  }, [map, routes, selectedId, config, sunMode]);

  return null;
}
