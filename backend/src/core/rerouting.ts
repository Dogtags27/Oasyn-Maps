/**
 * core/rerouting.ts — cheap rerouting and consent-based offers (R8).
 *
 * One backward Dijkstra from the destination yields dist-to-goal and a pointer
 * (prevNode/prevEdge) for every node. Because the graph is undirected, a tree
 * rooted at `goal` has prevNode[n] = the next node TOWARD goal from n, so the
 * remaining route from any position is pointer-following in O(path length) — no
 * new search (R8.2).
 *
 * Offers are never automatic switches (R8.3): emit only when J improves past
 * the hysteresis margin, or high-priority when the remaining path contains a
 * hard-unsafe edge (R8.4). Each offer carries deltas, trigger, expiry, and a
 * per-kind snooze key (R8.5, R8.6).
 */

import type { EngineRoute, PlanContext } from "./types.js";
import type { Offer } from "../../contract/schemas.js";
import { dijkstraTree, type Tree, type CostFn } from "./astar.js";
import { evaluateRoute } from "./route.js";
import { edgeTime, modeWeightsFor } from "./cost.js";
import { safety as safetyCfg, eps, SNOOZE_MIN } from "../config.js";
import { d } from "./descriptors.js";

/** Full mode cost function (mirrors edgeCost) for the backward tree. */
export function modeCostFn(ctx: PlanContext): CostFn {
  const { snap, heat, safety, pf } = ctx;
  const weights = modeWeightsFor(ctx);
  return (e: number) => {
    const S = safety[e]!;
    const isStep = snap.step[e] === 1;
    if (S > safetyCfg.S_hard) return Infinity;
    if (ctx.scenario.stepFree && isStep) return Infinity;
    const len = snap.len[e]!;
    const dt = edgeTime(len, isStep);
    const dtMin = dt / 60;
    return weights.w_t * dt + weights.w_h * pf * heat[e]! * dtMin + weights.w_s * S * (len / 100);
  };
}

/** Build the backward tree rooted at the goal node. */
export function backwardTree(ctx: PlanContext, goal: number): Tree {
  return dijkstraTree(ctx.graph, goal, modeCostFn(ctx));
}

/** Pointer-follow from `position` to the goal using the backward tree (R8.2). */
export function remainingRoute(
  ctx: PlanContext,
  tree: Tree,
  position: number,
  A0: number,
): EngineRoute | null {
  if (!Number.isFinite(tree.dist[position]!)) return null;
  const edges: number[] = [];
  const nodes: number[] = [position];
  let cur = position;
  let guard = 0;
  const maxHops = ctx.snap.V + 1;
  while (tree.prevEdge[cur]! >= 0) {
    edges.push(tree.prevEdge[cur]!);
    cur = tree.prevNode[cur]!;
    nodes.push(cur);
    if (++guard > maxHops) break; // safety against a malformed tree
  }
  if (edges.length === 0) return null;
  return evaluateRoute(ctx, edges, nodes, A0);
}

/** True if any edge on the route exceeds the hard-safety threshold (R8.4). */
export function hasHardUnsafeEdge(ctx: PlanContext, route: EngineRoute): boolean {
  for (const e of route.edges) if (ctx.safety[e]! > safetyCfg.S_hard) return true;
  return false;
}

export interface OfferInput {
  current: EngineRoute;
  candidate: EngineRoute;
  jCurrent: number;
  jCandidate: number;
  nowMs: number;
  /** candidate route id, surfaced on the offer. */
  candidateId?: string;
}

/**
 * Emit a reroute offer if the candidate beats the current past hysteresis, or a
 * high-priority offer when the current remaining path has a hard-unsafe edge.
 * Returns null (no offer) otherwise. Never switches automatically (R8.3).
 */
export function offerIfBetter(
  ctx: PlanContext,
  input: OfferInput,
  hardUnsafe: boolean,
): Offer | null {
  const { current, candidate, jCurrent, jCandidate, nowMs } = input;
  const expiryMs = nowMs + SNOOZE_MIN * 60 * 1000;

  if (hardUnsafe) {
    return {
      kind: "safety",
      deltaTimeSec: candidate.timeSec - current.timeSec,
      deltaHeatMinutes: candidate.heatMinutes - current.heatMinutes,
      deltaJ: jCandidate - jCurrent,
      trigger: d("offer.safety.trigger"),
      expiryMs,
      snoozeKey: "safety",
      priority: "high",
      ...(input.candidateId ? { routeId: input.candidateId } : {}),
    };
  }

  if (jCandidate < (1 - eps) * jCurrent) {
    return {
      kind: "reroute",
      deltaTimeSec: candidate.timeSec - current.timeSec,
      deltaHeatMinutes: candidate.heatMinutes - current.heatMinutes,
      deltaJ: jCandidate - jCurrent,
      trigger: d("offer.reroute.trigger", {
        deltaHeatMin: Math.round(current.heatMinutes - candidate.heatMinutes),
      }),
      expiryMs,
      snoozeKey: "reroute",
      priority: "normal",
      ...(input.candidateId ? { routeId: input.candidateId } : {}),
    };
  }

  return null;
}

/** Filter out offers whose snooze key the user has silenced (R8.6). */
export function applySnooze(offers: Offer[], snoozed: string[]): Offer[] {
  if (snoozed.length === 0) return offers;
  const set = new Set(snoozed);
  return offers.filter((o) => !set.has(o.snoozeKey));
}
