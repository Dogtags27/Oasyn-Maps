/**
 * core/graph.ts — graph access over the loaded CSR snapshot (R1.3).
 *
 * Pure and deterministic: no Date, no Math.random, ties broken by node id.
 * Provides:
 *   - CSR neighbour iteration (zero-allocation hot loop)
 *   - a spatial grid hash over projected node coords, built once
 *   - snap(latlng) -> nearest node (ties by id)
 *   - proximity queries for resources/features
 *
 * Distances use the snapshot's equirectangular projection (metres), consistent
 * with the build-time projection so snap and A* heuristics agree.
 */

import type { Snapshot } from "../snapshot.js";
import { gridCellM, earthRadiusM, center as cfgCenter } from "../config.js";

const toRad = (d: number) => (d * Math.PI) / 180;

export interface GraphView {
  snap: Snapshot;
  /** project a lat/lon to the snapshot's local metric plane. */
  project(lat: number, lon: number): [number, number];
  /** iterate neighbours of a node, calling fn(neighbourNode, edgeId). */
  forEachNeighbour(node: number, fn: (to: number, edge: number) => void): void;
  /** nearest node to a lat/lng; ties broken by lower node id (R1.3, R6.8). */
  snapNode(lat: number, lon: number): number;
  /** node ids within radiusM of a lat/lon (grid-accelerated). */
  nodesWithin(lat: number, lon: number, radiusM: number): number[];
}

type Cell = string;
const cellKey = (cx: number, cy: number): Cell => `${cx},${cy}`;

export function buildGraphView(snap: Snapshot): GraphView {
  const cosLat0 = Math.cos(toRad(snap.center?.lat ?? cfgCenter.lat));
  const lat0 = snap.center?.lat ?? cfgCenter.lat;
  const lon0 = snap.center?.lon ?? cfgCenter.lon;

  const project = (lat: number, lon: number): [number, number] => [
    earthRadiusM * toRad(lon - lon0) * cosLat0,
    earthRadiusM * toRad(lat - lat0),
  ];

  // Build the grid hash over projected node coords, once.
  const grid = new Map<Cell, number[]>();
  for (let i = 0; i < snap.V; i++) {
    const cx = Math.floor(snap.nodeX[i]! / gridCellM);
    const cy = Math.floor(snap.nodeY[i]! / gridCellM);
    const k = cellKey(cx, cy);
    let bucket = grid.get(k);
    if (!bucket) grid.set(k, (bucket = []));
    bucket.push(i);
  }

  const forEachNeighbour = (node: number, fn: (to: number, edge: number) => void): void => {
    const start = snap.offsets[node]!;
    const end = snap.offsets[node + 1]!;
    for (let p = start; p < end; p++) fn(snap.targets[p]!, snap.edgeOf[p]!);
  };

  const snapNode = (lat: number, lon: number): number => {
    const [x, y] = project(lat, lon);
    const cx = Math.floor(x / gridCellM);
    const cy = Math.floor(y / gridCellM);
    let best = -1;
    let bestD = Infinity;
    // Expand the search ring until at least one node is found, then finish the
    // ring + one extra to be safe (nearest could be in an adjacent cell).
    for (let ring = 0; ring < 64; ring++) {
      let found = false;
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          // Only the outer shell of this ring (inner shells already scanned).
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const bucket = grid.get(cellKey(cx + dx, cy + dy));
          if (!bucket) continue;
          found = true;
          for (const n of bucket) {
            const ex = snap.nodeX[n]! - x;
            const ey = snap.nodeY[n]! - y;
            const d = ex * ex + ey * ey;
            // Strictly-less keeps the lowest id on ties (buckets are id-ascending).
            if (d < bestD) {
              bestD = d;
              best = n;
            }
          }
        }
      }
      // Once we have a candidate, one more ring guarantees correctness.
      if (best >= 0 && !found) break;
      if (best >= 0 && ring > 0) break;
    }
    return best;
  };

  const nodesWithin = (lat: number, lon: number, radiusM: number): number[] => {
    const [x, y] = project(lat, lon);
    const r2 = radiusM * radiusM;
    const reach = Math.ceil(radiusM / gridCellM);
    const cx = Math.floor(x / gridCellM);
    const cy = Math.floor(y / gridCellM);
    const out: number[] = [];
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        const bucket = grid.get(cellKey(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const n of bucket) {
          const ex = snap.nodeX[n]! - x;
          const ey = snap.nodeY[n]! - y;
          if (ex * ex + ey * ey <= r2) out.push(n);
        }
      }
    }
    out.sort((a, b) => a - b); // deterministic order (ties by id)
    return out;
  };

  return { snap, project, forEachNeighbour, snapNode, nodesWithin };
}

/** Equirectangular distance in metres between two lat/lon points. */
export function equirectDist(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
  cosLat0: number = Math.cos(toRad(cfgCenter.lat)),
): number {
  const x = earthRadiusM * toRad(bLon - aLon) * cosLat0;
  const y = earthRadiusM * toRad(bLat - aLat);
  return Math.sqrt(x * x + y * y);
}
