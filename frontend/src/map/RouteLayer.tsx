/**
 * map/RouteLayer.tsx — route rendering (R4.2, R4.3, R16.4).
 *
 * Selected route: a soft shadow and white casing under a 7px colour line, drawn
 * per segment with the colour from the config ramp; high-heat segments also get
 * a redundant paper tick overlay (colour is never the sole signal). Alternatives
 * render as a dotted soft-blue line on a white casing. Lines fade in on draw. Exposure per segment is sampled from the route's
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

    const casingColor = resolveVar("var(--route-casing)");
    const shadowColor = resolveVar("var(--route-shadow)");
    const altColor = resolveVar("var(--route-alt)");
    const paperColor = resolveVar("var(--paper)");

    // Draw alternatives first so the selected route sits on top. Alternatives
    // are a soft blue with a white casing (map-app style), dashed so they are
    // distinguishable from the selection without relying on colour.
    for (const route of routes) {
      if (route.id === selectedId) continue;
      const latlngs = route.geometry.map(toLatLng);
      L.polyline(latlngs, {
        color: casingColor,
        weight: 9,
        opacity: 0.95,
        className: "oasyn-route oasyn-route--alt",
      }).addTo(group);
      L.polyline(latlngs, {
        color: altColor,
        weight: 5,
        opacity: 1,
        dashArray: "1 9",
        lineCap: "round",
        className: "oasyn-route oasyn-route--alt",
      }).addTo(group);
    }

    const selected = routes.find((r) => r.id === selectedId);
    if (selected && selected.geometry.length >= 2) {
      const pts = selected.geometry;
      const latlngs = pts.map(toLatLng);
      // Soft shadow + white casing under the whole route.
      L.polyline(latlngs, {
        color: shadowColor,
        weight: 15,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        className: "oasyn-route oasyn-route--shadow",
      }).addTo(group);
      L.polyline(latlngs, {
        color: casingColor,
        weight: 12,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        className: "oasyn-route",
      }).addTo(group);
      // Per-segment colour line.
      for (let i = 0; i < pts.length - 1; i++) {
        const frac = i / Math.max(1, pts.length - 2);
        const a = exposureAlong(selected, frac);
        const band = rampBand(a, cfg.bands);
        const color = resolveVar(bandColorVar(band));
        const seg: [number, number][] = [toLatLng(pts[i]), toLatLng(pts[i + 1])];
        L.polyline(seg, {
          color,
          weight: 7,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          className: "oasyn-route",
        }).addTo(group);
        // Redundant paper tick overlay on high-heat segments (R16.4).
        if (isHighHeat(a, cfg.bands)) {
          L.polyline(seg, {
            color: paperColor,
            weight: 7,
            opacity: 1,
            dashArray: "2 10",
            className: "oasyn-route",
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
