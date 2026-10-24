/**
 * frontier-scoring.test.ts — frontier non-dominance + scoring (R17.3, R17.4).
 */

import { describe, it, expect } from "vitest";
import { toCSR, makeProjection, type Graph } from "../scripts/lib/graph-build.mjs";
import { buildGraphView } from "../src/core/graph.js";
import { frontier } from "../src/core/frontier.js";
import { rank, coolestWithinCap } from "../src/core/scoring.js";
import { personalFactor } from "../src/core/cost.js";
import type { PlanContext, Mode } from "../src/core/types.js";
import type { Snapshot } from "../src/snapshot.js";

const center = { lat: 42.341, lon: -71.084 };
const project = makeProjection(center).project;

/**
 * Two parallel routes from 0 to 3:
 *   fast lane  0-1-3  short, high heat
 *   cool lane  0-2-3  longer, low heat
 */
function twoLaneGraph(): Graph {
  const nodes: [number, number][] = [
    [42.3400, -71.0900], // 0 start
    [42.3400, -71.0880], // 1 fast mid
    [42.3410, -71.0880], // 2 cool mid
    [42.3400, -71.0860], // 3 goal
  ];
  const mk = (u: number, v: number, len: number) => ({
    u, v, len, kind: "footway", step: false, trees: 0, park: 0, bldg: 0,
    geom: [nodes[u]!, nodes[v]!] as [number, number][],
  });
  return { nodes, edges: [mk(0, 1, 100), mk(1, 3, 100), mk(0, 2, 140), mk(2, 3, 140)] };
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

/** Context with hand-set heat per edge (fast lane hot, cool lane cold). */
function makeCtx(snap: Snapshot, mode: Mode, pf: number): PlanContext {
  const graph = buildGraphView(snap);
  // edge ids follow insertion order: 0:(0-1) 1:(1-3) 2:(0-2) 3:(2-3)
  snap.heat[0] = 0.9; snap.heat[1] = 0.9; // fast lane: hot
  snap.heat[2] = 0.1; snap.heat[3] = 0.1; // cool lane: cold
  return {
    snap, graph,
    scenario: { timeMs: 0, tempC: 35, rh: 40, cloud: 0, priorWalkMin: 0, stepFree: false },
    env: { s: 1, azimuth: 0, I: 1, theta: 1, appTemp: 40 },
    heat: snap.heat, safety: snap.safety, pf, cMin: 1 / 1.4, mode,
  };
}

describe("frontier (R6.2, R6.3, R17.3)", () => {
  it("endpoints are the fastest and the coolest routes; all non-dominated", () => {
    const snap = snapshotFrom(twoLaneGraph());
    const ctx = makeCtx(snap, "balanced", 1);
    const routes = frontier(ctx, 0, 3, 0);
    expect(routes.length).toBeGreaterThanOrEqual(2);

    // Fastest = min time; coolest = min personal heat X.
    const fastest = routes.reduce((a, b) => (b.timeSec < a.timeSec ? b : a));
    const coolest = routes.reduce((a, b) => (b.x < a.x ? b : a));
    expect(fastest.timeSec).toBeLessThanOrEqual(coolest.timeSec + 1e-6);
    expect(coolest.x).toBeLessThanOrEqual(fastest.x + 1e-6);

    // Non-dominated: no route is both slower-or-equal AND hotter-or-equal than another.
    for (const a of routes) {
      for (const b of routes) {
        if (a === b) continue;
        const dominated = b.timeSec <= a.timeSec + 1e-6 && b.x <= a.x + 1e-6 &&
          (b.timeSec < a.timeSec - 1e-6 || b.x < a.x - 1e-6);
        expect(dominated).toBe(false);
      }
    }
  });
});

describe("scoring (R6.4, R6.5, R17.4)", () => {
  it("higher A0 raises the personal factor", () => {
    const hrBase = 70;
    const low = personalFactor({ A0: 0.1, hrBase });
    const high = personalFactor({ A0: 0.8, hrBase });
    expect(high).toBeGreaterThan(low);
  });

  it("coolest picks the lower-heat route within the cap", () => {
    const snap = snapshotFrom(twoLaneGraph());
    const ctx = makeCtx(snap, "coolest", 1);
    const routes = frontier(ctx, 0, 3, 0);
    const pick = coolestWithinCap(ctx, routes);
    expect(pick).not.toBeNull();
    // The coolest route should be the low-heat lane (edges 2,3).
    expect(pick!.x).toBeLessThanOrEqual(Math.min(...routes.map((r) => r.x)) + 1e-9);
  });

  it("hard safety is never overridden (route over S_hard is infeasible)", () => {
    const snap = snapshotFrom(twoLaneGraph());
    const ctx = makeCtx(snap, "balanced", 1);
    // Make the fast lane hard-unsafe.
    snap.safety[0] = 0.95; snap.safety[1] = 0.95;
    const routes = frontier(ctx, 0, 3, 0);
    // Frontier must avoid the blocked lane entirely.
    for (const r of routes) {
      expect(r.edges).not.toContain(0);
      expect(r.edges).not.toContain(1);
    }
    const scored = rank(ctx, routes);
    for (const s of scored) expect(s.route.safetyMax).toBeLessThanOrEqual(0.8);
  });
});
