/**
 * core/cooling.ts — cooling via-stop evaluation (R9).
 *
 * Two Dijkstra trees — forward from start (D_s) and backward from goal (D_t) —
 * let every candidate resource be scored in O(#resources) with NO extra search:
 *   cost_via(r) = D_s[n_r] + D_t[n_r] + dwell_cost(r)
 *
 * When projected arrival exposure is high, we compute A_T through each resource
 * (with a cooling dwell) and offer the best stop within the detour cap when A_T
 * drops by at least delta_A (R9.3).
 */

import type { EngineRoute, PlanContext } from "./types.js";
import type { Offer } from "../../contract/schemas.js";
import { dijkstraTree, type Tree } from "./astar.js";
import { modeCostFn } from "./rerouting.js";
import { evaluateRoute } from "./route.js";
import { dwellA, arrivalExposure } from "./exposure.js";
import { edgeTime, modeWeightsFor } from "./cost.js";
import { delta_A, SNOOZE_MIN } from "../config.js";
import { d } from "./descriptors.js";

export interface Resource {
  /** snapped graph node id for the resource. */
  node: number;
  /** display name for the offer descriptor. */
  name: string;
  /** cooling dwell seconds at the resource. */
  dwellSec: number;
  /** reduced heat rate during the dwell (default 0 = full shade/AC). */
  dwellHeat?: number;
}

export interface ViaStopResult {
  offer: Offer;
  resource: Resource;
  /** the composed route start -> resource -> goal. */
  route: EngineRoute;
}

/** Per-edge durations/heats along an edge list (for arrival-exposure recompute). */
function legSeries(ctx: PlanContext, edges: number[]): { dts: number[]; hs: number[] } {
  const dts: number[] = [];
  const hs: number[] = [];
  for (const e of edges) {
    dts.push(edgeTime(ctx.snap.len[e]!, ctx.snap.step[e] === 1));
    hs.push(ctx.heat[e]!);
  }
  return { dts, hs };
}

/**
 * Evaluate via-stops. Returns the best within-cap offer that lowers arrival
 * exposure by >= delta_A, or null. `directRoute` is the current best direct
 * route (for the baseline A_T and the detour cap).
 */
export function viaStops(
  ctx: PlanContext,
  start: number,
  goal: number,
  resources: Resource[],
  directRoute: EngineRoute,
  A0: number,
  nowMs: number,
): ViaStopResult | null {
  if (resources.length === 0) return null;

  const costFn = modeCostFn(ctx);
  const fwd: Tree = dijkstraTree(ctx.graph, start, costFn);
  const bwd: Tree = dijkstraTree(ctx.graph, goal, costFn);

  const w = modeWeightsFor(ctx);
  const cap = w.rho * directRoute.timeSec; // detour cap on time

  const baselineAT = directRoute.aEnd;

  let best: ViaStopResult | null = null;
  let bestAT = baselineAT;

  for (const r of resources) {
    if (!Number.isFinite(fwd.dist[r.node]!) || !Number.isFinite(bwd.dist[r.node]!)) continue;

    // Reconstruct the two legs by pointer-following each tree to the resource.
    const toR = pathTo(fwd, r.node);
    const fromR = pathTo(bwd, r.node);
    if (!toR || !fromR) continue;

    // Compose start -> r (fwd leg) then r -> goal (reverse of bwd leg).
    const legEdges = [...toR.edges, ...fromR.edges.slice().reverse()];
    const legNodes = [...toR.nodes, ...fromR.nodes.slice().reverse().slice(1)];

    const composed = evaluateRoute(ctx, legEdges, legNodes, A0);
    // Time includes the dwell.
    const totalTime = composed.timeSec + r.dwellSec;
    if (totalTime > cap + 1e-6) continue; // outside detour cap

    // A_T with a cooling dwell inserted at the resource.
    const leg1 = legSeries(ctx, toR.edges);
    const leg2 = legSeries(ctx, fromR.edges.slice().reverse());
    const afterLeg1 = arrivalExposure(A0, leg1.dts, leg1.hs);
    const afterDwell = dwellA(afterLeg1, r.dwellSec, r.dwellHeat ?? 0);
    const aT = arrivalExposure(afterDwell, leg2.dts, leg2.hs);

    if (baselineAT - aT >= delta_A && aT < bestAT) {
      bestAT = aT;
      const offer: Offer = {
        kind: "via_stop",
        deltaTimeSec: totalTime - directRoute.timeSec,
        deltaHeatMinutes: composed.heatMinutes - directRoute.heatMinutes,
        deltaJ: 0, // J delta is route-ranking specific; filled by the route layer if needed
        trigger: d("offer.viaStop.trigger", { name: r.name, deltaA: round3(baselineAT - aT) }),
        expiryMs: nowMs + SNOOZE_MIN * 60 * 1000,
        snoozeKey: "via_stop",
        priority: "normal",
      };
      best = { offer, resource: r, route: { ...composed, aEnd: aT } };
    }
  }
  return best;
}

/** Pointer-follow a tree from the root toward `node`, returning edges/nodes. */
function pathTo(tree: Tree, node: number): { edges: number[]; nodes: number[] } | null {
  if (!Number.isFinite(tree.dist[node]!)) return null;
  const edges: number[] = [];
  const nodes: number[] = [node];
  let cur = node;
  let guard = 0;
  while (tree.prevEdge[cur]! >= 0) {
    edges.push(tree.prevEdge[cur]!);
    cur = tree.prevNode[cur]!;
    nodes.push(cur);
    if (++guard > tree.dist.length + 1) break;
  }
  edges.reverse();
  nodes.reverse();
  return { edges, nodes };
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
