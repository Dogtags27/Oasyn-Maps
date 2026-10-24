/**
 * coverage.test.ts — multi-source coverage correctness (R12.1, R17.4):
 *   the multi-source nearest-oasis distance equals the min over single-source
 *   Dijkstra runs, on a small graph.
 */

import { describe, it, expect } from "vitest";
import { toCSR, makeProjection, type Graph } from "../scripts/lib/graph-build.mjs";
import { buildGraphView } from "../src/core/graph.js";
import { dijkstraTree, multiSource } from "../src/core/astar.js";
import { timeCostFn, oasisCoverage } from "../src/core/coverage.js";
import type { PlanContext } from "../src/core/types.js";
import type { Snapshot } from "../src/snapshot.js";

const center = { lat: 42.341, lon: -71.084 };
const project = makeProjection(center).project;

/** 3x3 grid so there are several nodes and two oasis sources. */
function grid(rows: number, cols: number): Graph {
  const nodes: [number, number][] = [];
  const idx = (r: number, c: number) => r * cols + c;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      nodes.push([center.lat + r * 0.001, center.lon + c * 0.001]);
  const edges: Graph["edges"] = [];
  const mk = (u: number, v: number) => {
    const dy = (nodes[v]![0] - nodes[u]![0]) * 111000;
    const dx = (nodes[v]![1] - nodes[u]![1]) * 82300;
    const len = Math.sqrt(dx * dx + dy * dy);
    edges.push({ u, v, len, kind: "footway", step: false, trees: 0, park: 0, bldg: 0, geom: [nodes[u]!, nodes[v]!] });
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) mk(idx(r, c), idx(r, c + 1));
      if (r + 1 < rows) mk(idx(r, c), idx(r + 1, c));
    }
  return { nodes, edges };
}

function snapshotFrom(graph: Graph): Snapshot {
  const csr = toCSR(graph, project);
  return {
    V: csr.V, E: csr.E, center,
    offsets: csr.arrays.offsets, targets: csr.arrays.targets, edgeOf: csr.arrays.edgeOf,
    len: csr.arrays.len, trees: csr.arrays.trees, park: csr.arrays.park, bldg: csr.arrays.bldg,
    step: csr.arrays.step, nodeLat: csr.arrays.nodeLat, nodeLon: csr.arrays.nodeLon,
    nodeX: csr.arrays.nodeX, nodeY: csr.arrays.nodeY,
    heat: new Float32Array(csr.E), safety: new Float32Array(csr.E),
    meta: { version: "test", nodes: csr.V, edges: csr.E, layers: [] },
    source: { kind: "local" },
  };
}

function makeCtx(snap: Snapshot): PlanContext {
  return {
    snap, graph: buildGraphView(snap),
    scenario: { timeMs: 0, tempC: 25, rh: 50, cloud: 0.3, priorWalkMin: 0, stepFree: false },
    env: { s: 0.5, azimuth: 0, I: 0.5, theta: 0.3, appTemp: 26 },
    heat: snap.heat, safety: snap.safety, pf: 1, cMin: 1 / 1.4, mode: "fastest",
  };
}

describe("multi-source coverage (R12.1, R17.4)", () => {
  it("multi-source distance equals the min over single-source runs", () => {
    const snap = snapshotFrom(grid(4, 4));
    const ctx = makeCtx(snap);
    const cost = timeCostFn(ctx);
    const sources = [0, snap.V - 1]; // two opposite corners

    const multi = multiSource(ctx.graph, sources, cost);
    const singles = sources.map((s) => dijkstraTree(ctx.graph, s, cost).dist);

    for (let n = 0; n < snap.V; n++) {
      const minSingle = Math.min(...singles.map((d) => d[n]!));
      expect(multi.dist[n]!).toBeCloseTo(minSingle, 6);
    }
  });

  it("coverage shares are in [0,100] and monotone (within5 <= within10)", () => {
    const snap = snapshotFrom(grid(5, 5));
    const ctx = makeCtx(snap);
    const result = oasisCoverage(ctx, [12]); // center oasis
    expect(result.within5).toBeGreaterThanOrEqual(0);
    expect(result.within10).toBeLessThanOrEqual(1);
    expect(result.within5).toBeLessThanOrEqual(result.within10 + 1e-9);
  });
});
