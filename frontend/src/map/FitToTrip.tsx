/**
 * map/FitToTrip.tsx — keep the trip in view.
 *
 *  - When a route arrives (or the user picks a different route card), zoom the
 *    map to frame the selected route plus both endpoints.
 *  - While a plan is still computing, frame the start and destination so the
 *    map moves the moment the second place is picked.
 *  - With only one endpoint set, pan to it if it is off screen.
 *
 * Framing accounts for the UI floating over the map (search dock on top, the
 * bottom sheet on phones) by measuring those elements, so the route is never
 * hidden underneath them. Motion follows the reduced-motion preference.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "./MapContext";
import { useStore } from "@/store";
import type { LatLngT } from "@/api/types";

/** Breathing room around the framed trip, px. */
const MARGIN = 28;
/** Never zoom in closer than this when framing (a 50 m trip shouldn't fill the screen). */
const MAX_FIT_ZOOM = 17;

/** How much of the map (px) each floating overlay covers, measured live. */
function overlayInsets(map: L.Map): { top: number; bottom: number; left: number; right: number } {
  const box = map.getContainer().getBoundingClientRect();
  const covered = (sel: string, edge: "top" | "bottom") => {
    const el = document.querySelector(sel);
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    // Ignore overlays that do not actually sit over the map horizontally.
    if (r.right <= box.left || r.left >= box.right || r.width === 0) return 0;
    const px = edge === "top" ? r.bottom - box.top : box.bottom - r.top;
    // Cap so a tall sheet can't squeeze the route into a sliver.
    return Math.max(0, Math.min(px, box.height * 0.55));
  };
  return {
    top: covered(".search-dock", "top"),
    bottom: covered(".sheet", "bottom"),
    left: 0,
    right: 0,
  };
}

function fit(map: L.Map, points: LatLngT[], animate: boolean): void {
  if (points.length === 0) return;
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
  const inset = overlayInsets(map);
  map.fitBounds(bounds, {
    paddingTopLeft: [inset.left + MARGIN, inset.top + MARGIN],
    paddingBottomRight: [inset.right + MARGIN, inset.bottom + MARGIN],
    maxZoom: MAX_FIT_ZOOM,
    animate,
    duration: animate ? 0.6 : 0,
  });
}

export function FitToTrip() {
  const map = useMap();
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);
  const routes = useStore((s) => s.routes);
  const selectedId = useStore((s) => s.selectedId);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const lastFramed = useRef<string>("");

  useEffect(() => {
    if (!map) return;
    const animate = !reducedMotion;
    const selected = routes.find((r) => r.id === selectedId);
    const endpoints = [start, goal].filter((p): p is LatLngT => p !== null);

    // A route that belongs to the current endpoints: frame the whole route.
    const routeMatchesTrip =
      selected && start && goal && selected.geometry.length >= 2 && endsNear(selected.geometry, start, goal);
    let key: string;
    let points: LatLngT[];
    if (routeMatchesTrip) {
      key = `route:${selected.id}`;
      points = [...selected.geometry, ...endpoints];
    } else if (start && goal) {
      key = `ends:${start.lat},${start.lng}|${goal.lat},${goal.lng}`;
      points = endpoints;
    } else if (endpoints.length === 1) {
      const p = endpoints[0]!;
      key = `one:${p.lat},${p.lng}`;
      if (lastFramed.current === key) return;
      lastFramed.current = key;
      // Only move if the single point is off screen (don't fight map taps).
      if (!map.getBounds().pad(-0.1).contains([p.lat, p.lng])) {
        map.panTo([p.lat, p.lng], { animate });
      }
      return;
    } else {
      return;
    }

    if (lastFramed.current === key) return;
    lastFramed.current = key;
    fit(map, points, animate);
  }, [map, start, goal, routes, selectedId, reducedMotion]);

  return null;
}

/** Metres between two points (equirectangular; fine at city scale). */
function distM(a: LatLngT, b: LatLngT): number {
  const kx = 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * 110_540);
}

/**
 * True when a route's ends are near the current start and goal. Guards against
 * framing a stale route from the previous trip while the new plan computes.
 * Routes snap to the street graph, so allow a generous tolerance.
 */
function endsNear(geometry: LatLngT[], start: LatLngT, goal: LatLngT): boolean {
  const TOL_M = 400;
  const first = geometry[0]!;
  const last = geometry[geometry.length - 1]!;
  return distM(first, start) < TOL_M && distM(last, goal) < TOL_M;
}
