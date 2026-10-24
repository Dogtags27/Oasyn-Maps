/**
 * rerouting.test.ts — reroute offers (R8, R17.4):
 *   - no offer below the hysteresis margin
 *   - offer (not an automatic switch) on a hard-unsafe remaining edge
 *   - snooze suppresses an offer by kind
 *   - backward tree + pointer-following reconstructs the remaining route
 */

import { describe, it, expect } from "vitest";
import { toCSR, makeProjection, type Graph } from "../scripts/lib/graph-build.mjs";
import { buildGraphView } from "../src/core/graph.js";
import {
  backwardTree,
  remainingRoute,
  offerIfBetter,
  applySnooze,
  hasHardUnsafeEdge,
} from "../src/core/rerouting.js";
import { evaluateRoute } from "../src/core/route.js";
import { pairwiseJ } from "../src/core/scoring.js";
import type { PlanContext, Mode } from "../src/core/types.js";
import type { Snapshot } from "../src/snapshot.js";
import { eps } from "../src/config.js";

const center = { lat: 42.341, lon: -71.084 };
const project = makeProjection(center).project;

/** Chain 0-1-2-3 so the backward tree from 3 pointer-follows cleanly. */
function chain(): Graph {
  const nodes: [number, number][] = [
    [42.3400, -71.0900],
    [42.3400, -71.0880],
    [42.3400, -71.0860],
    [42.3400, -71.0840],
  ];
  const mk = (u: number, v: number) => ({
    u, v, len: 120, kind: "footway", step: false, trees: 0, park: 0, bldg: 0,
    geom: [nodes[u]!, nodes[v]!] as [number, number][],
  });
  return { nodes, edges: [mk(0, 1), mk(1, 2), mk(2, 3)] };
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

function makeCtx(snap: Snapshot, mode: Mode = "balanced"): PlanContext {
  const graph = buildGraphView(snap);
  return {
    snap, graph,
    scenario: { timeMs: 0, tempC: 30, rh: 40, cloud: 0.2, priorWalkMin: 0, stepFree: false },
    env: { s: 1, azimuth: 0, I: 0.8, theta: 0.5, appTemp: 32 },
    heat: snap.heat, safety: snap.safety, pf: 1, cMin: 1 / 1.4, mode,
  };
}

describe("backward tree + remaining route (R8.1, R8.2)", () => {
  it("pointer-follows from a mid position to the goal", () => {
    const snap = snapshotFrom(chain());
    const ctx = makeCtx(snap);
    const tree = backwardTree(ctx, 3); // goal node 3
    const remaining = remainingRoute(ctx, tree, 1, 0); // from node 1
    expect(remaining).not.toBeNull();
    // node 1 -> 2 -> 3 = 2 edges, 240 m.
    expect(remaining!.nodes[0]).toBe(1);
    expect(remaining!.nodes[remaining!.nodes.length - 1]).toBe(3);
    expect(remaining!.distanceM).toBeCloseTo(240, 6);
  });
});

describe("offer hysteresis and hard-block (R8.3, R8.4)", () => {
  const snap = snapshotFrom(chain());
  const ctx = makeCtx(snap);
  const current = evaluateRoute(ctx, [0, 1, 2], [0, 1, 2, 3], 0);

  it("no offer when the candidate is not better past the hysteresis margin", () => {
    // candidate marginally better (within eps) -> no offer.
    const jCurrent = 1.0;
    const jCandidate = jCurrent * (1 - eps * 0.5);
    const offer = offerIfBetter(
      ctx,
      { current, candidate: current, jCurrent, jCandidate, nowMs: 0 },
      false,
    );
    expect(offer).toBeNull();
  });

  it("offer (not switch) when the candidate beats the hysteresis margin", () => {
    const jCurrent = 1.0;
    const jCandidate = jCurrent * (1 - eps * 2);
    const offer = offerIfBetter(
      ctx,
      { current, candidate: current, jCurrent, jCandidate, nowMs: 0 },
      false,
    );
    expect(offer).not.toBeNull();
    expect(offer!.kind).toBe("reroute");
  });

  it("high-priority safety offer when the remaining path is hard-unsafe", () => {
    snap.safety[1] = 0.95; // block the middle edge
    expect(hasHardUnsafeEdge(ctx, current)).toBe(true);
    const offer = offerIfBetter(
      ctx,
      { current, candidate: current, jCurrent: 1, jCandidate: 1, nowMs: 0 },
      true,
    );
    expect(offer).not.toBeNull();
    expect(offer!.kind).toBe("safety");
    expect(offer!.priority).toBe("high");
    snap.safety[1] = 0; // reset
  });
});

describe("snooze (R8.6)", () => {
  it("suppresses an offer whose kind is snoozed", () => {
    const snap = snapshotFrom(chain());
    const ctx = makeCtx(snap);
    const current = evaluateRoute(ctx, [0, 1, 2], [0, 1, 2, 3], 0);
    const offer = offerIfBetter(
      ctx,
      { current, candidate: current, jCurrent: 1, jCandidate: 0.5, nowMs: 0 },
      false,
    );
    expect(offer).not.toBeNull();
    expect(applySnooze([offer!], ["reroute"])).toHaveLength(0);
    expect(applySnooze([offer!], ["safety"])).toHaveLength(1);
  });
});

describe("pairwise J for reroute decision (R8.3)", () => {
  it("candidate (reference) scores no higher than a worse committed route", () => {
    const candidate = { timeSec: 300, personalHeat: 2, safetyMax: 0.1 };
    // Committed remaining route is slower and hotter -> should score higher J.
    const worseCurrent = { timeSec: 420, personalHeat: 5, safetyMax: 0.1 };
    const jCand = pairwiseJ("balanced", candidate, candidate);
    const jCur = pairwiseJ("balanced", worseCurrent, candidate);
    expect(jCur).toBeGreaterThan(jCand);
  });

  it("an equal committed route yields no reroute offer (hysteresis)", () => {
    const candidate = { timeSec: 300, personalHeat: 2, safetyMax: 0.1 };
    const jCand = pairwiseJ("balanced", candidate, candidate);
    const jCur = pairwiseJ("balanced", candidate, candidate);
    // offerIfBetter needs jCandidate < (1-eps)*jCurrent; equal -> no offer.
    expect(jCand < (1 - eps) * jCur).toBe(false);
  });

  it("a materially worse committed route clears the hysteresis margin", () => {
    const candidate = { timeSec: 300, personalHeat: 2, safetyMax: 0.1 };
    const worseCurrent = { timeSec: 600, personalHeat: 8, safetyMax: 0.1 };
    const jCand = pairwiseJ("balanced", candidate, candidate);
    const jCur = pairwiseJ("balanced", worseCurrent, candidate);
    expect(jCand < (1 - eps) * jCur).toBe(true);
  });
});
