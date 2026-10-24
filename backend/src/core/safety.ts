/**
 * core/safety.ts — the safety field over edges (R7).
 *
 * S_e = max_z q_z * exp(-(d/r_z)^2)   (Gaussian kernel, max over SIMULATED zones)
 * where d is the distance from the edge midpoint to the zone center.
 *
 * Zones are always SIMULATED (R7.2). Hard masking (S > S_hard -> Infinity cost)
 * is applied in edgeCost; the retry-without-block-on-disconnect logic lives in
 * the plan route (R7.4) since it needs a second search.
 */

import type { Snapshot } from "../snapshot.js";
import type { Zone } from "../../contract/schemas.js";

const EARTH_R = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Safety value at a projected point (metres) against all zones; max kernel. */
export function safetyAt(
  x: number,
  y: number,
  zones: ProjectedZone[],
): number {
  let s = 0;
  for (const z of zones) {
    const dx = x - z.x;
    const dy = y - z.y;
    const d2 = dx * dx + dy * dy;
    const val = z.q * Math.exp(-d2 / (z.r * z.r));
    if (val > s) s = val;
  }
  return s;
}

interface ProjectedZone {
  x: number;
  y: number;
  q: number;
  r: number;
}

function projectZones(zones: Zone[], center: { lat: number; lon: number }): ProjectedZone[] {
  const cosLat0 = Math.cos(toRad(center.lat));
  return zones.map((z) => ({
    x: EARTH_R * toRad(z.center.lng - center.lon) * cosLat0,
    y: EARTH_R * toRad(z.center.lat - center.lat),
    q: z.q,
    r: z.r,
  }));
}

/**
 * Fill the snapshot's runtime `safety` array in O(E) for the given zones.
 * Each edge is scored at its midpoint (the geometry endpoints' average in the
 * projected plane). Mutates and returns snap.safety.
 */
export function buildSafetyArray(
  snap: Snapshot,
  zones: Zone[],
  center: { lat: number; lon: number },
): Float32Array {
  const safety = snap.safety;
  if (zones.length === 0) {
    safety.fill(0);
    return safety;
  }
  const pz = projectZones(zones, center);

  // Edge midpoint = midpoint of its two endpoint nodes in the projected plane.
  // We recover an edge's endpoints from the CSR arrays via the first arc we see.
  // Build a one-pass endpoint lookup: for each directed arc (u -> targets[p]),
  // edgeOf[p] = e; record u and v once.
  const uOf = new Int32Array(snap.E).fill(-1);
  const vOf = new Int32Array(snap.E).fill(-1);
  for (let u = 0; u < snap.V; u++) {
    const start = snap.offsets[u]!;
    const end = snap.offsets[u + 1]!;
    for (let p = start; p < end; p++) {
      const e = snap.edgeOf[p]!;
      if (uOf[e] === -1) uOf[e] = u;
      else if (vOf[e] === -1) vOf[e] = snap.targets[p]!;
    }
  }

  for (let e = 0; e < snap.E; e++) {
    const u = uOf[e]!;
    const v = vOf[e]! >= 0 ? vOf[e]! : u;
    const mx = (snap.nodeX[u]! + snap.nodeX[v]!) / 2;
    const my = (snap.nodeY[u]! + snap.nodeY[v]!) / 2;
    safety[e] = safetyAt(mx, my, pz);
  }
  return safety;
}
