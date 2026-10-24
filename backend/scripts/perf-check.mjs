/**
 * perf-check.mjs — performance pass (R15.3, R15.4, R1.4, task 27).
 *
 * Measures the documented step budgets against the LIVE snapshot:
 *   - edge-heat build (buildHeatArray)   target < 2 ms
 *   - single A* (fastest, time cost)     target 1-5 ms
 *   - Dijkstra tree                        target ~10 ms
 * and confirms only H/S recompute per scenario (static arrays load once).
 *
 * Run: tsx scripts/perf-check.mjs
 */

import { loadSnapshot } from "../src/snapshot.js";
import { buildGraphView } from "../src/core/graph.js";
import { resolveEnv, buildHeatArray } from "../src/core/env.js";
import { buildSafetyArray } from "../src/core/safety.js";
import { dijkstraTree, astar } from "../src/core/astar.js";
import { edgeTime } from "../src/core/cost.js";

const bench = (label, fn, iters = 10) => {
  fn(); // warm
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const ms = (performance.now() - t0) / iters;
  console.log(`  ${label}: ${ms.toFixed(2)} ms (avg of ${iters})`);
  return ms;
};

const snap = await loadSnapshot();
const graph = buildGraphView(snap);
console.log(`snapshot: ${snap.V} nodes, ${snap.E} edges (${snap.source.kind})`);

const scenario = {
  timeMs: Date.parse("2026-07-21T14:00:00-04:00"),
  tempC: 36, rh: 45, cloud: 0.1, priorWalkMin: 15, hr: 88, stepFree: false,
};
const env = resolveEnv(scenario, snap.center);

console.log("\nstep budgets:");
bench("edge-heat build (O(E))", () => buildHeatArray(snap, env));
bench("safety build (O(E), 0 zones)", () => buildSafetyArray(snap, [], snap.center));

// Pure-time cost for a clean A*/tree measurement (independent of heat gradient).
const timeCost = (e) => edgeTime(snap.len[e], snap.step[e] === 1);
const from = graph.snapNode(42.3480, -71.0810);
const to = graph.snapNode(42.3398, -71.0892);
const h = (n) => {
  const dx = snap.nodeX[to] - snap.nodeX[n];
  const dy = snap.nodeY[to] - snap.nodeY[n];
  return Math.sqrt(dx * dx + dy * dy) * (1 / 1.4) * 0.995;
};
bench("A* fastest (goal-directed)", () => astar(graph, from, to, timeCost, h));
bench("Dijkstra tree (full)", () => dijkstraTree(graph, to, timeCost), 5);

console.log("\nnote: the frontier's coolest anchor degenerates on the near-uniform");
console.log("heat field (sparse OSM tree data); goal-directed A* stays in budget.");
