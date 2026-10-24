/**
 * lab/playback.ts — playback interpolation helpers (R7.2).
 *
 * The walker advances along the route geometry and its accumulated exposure A is
 * SAMPLED from the response aTrace — never recomputed. aTrace is a list of
 * [timeSec, distanceM, A] triples; we interpolate A linearly by sim time.
 */
import type { LatLngT, RouteResultT } from "@/api/types";

/** Interpolate A at a given sim time (seconds) from the route's aTrace. */
export function exposureAt(route: RouteResultT, simSec: number): number {
  const trace = route.aTrace;
  if (trace.length === 0) return 0;
  if (simSec <= trace[0][0]) return trace[0][2];
  const last = trace[trace.length - 1];
  if (simSec >= last[0]) return last[2];
  for (let i = 0; i < trace.length - 1; i++) {
    const [t0, , a0] = trace[i];
    const [t1, , a1] = trace[i + 1];
    if (simSec >= t0 && simSec <= t1) {
      const f = t1 === t0 ? 0 : (simSec - t0) / (t1 - t0);
      return a0 + (a1 - a0) * f;
    }
  }
  return last[2];
}

/** Fractional progress [0,1] along the route by sim time vs total duration. */
export function progressAt(route: RouteResultT, simSec: number): number {
  if (route.timeSec <= 0) return 0;
  return Math.max(0, Math.min(1, simSec / route.timeSec));
}

/** Position along the geometry at a fractional progress (linear by vertex). */
export function positionAt(route: RouteResultT, progress: number): LatLngT | null {
  const g = route.geometry;
  if (g.length === 0) return null;
  if (g.length === 1) return g[0];
  const span = g.length - 1;
  const scaled = Math.max(0, Math.min(1, progress)) * span;
  const i = Math.min(span - 1, Math.floor(scaled));
  const f = scaled - i;
  return {
    lat: g[i].lat + (g[i + 1].lat - g[i].lat) * f,
    lng: g[i].lng + (g[i + 1].lng - g[i].lng) * f,
  };
}
