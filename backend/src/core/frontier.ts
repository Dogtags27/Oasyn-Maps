/**
 * core/frontier.ts — supported Pareto frontier in (time, personal-heat) via the
 * Aneja-Nair dichotomic weighted-sum method (R6.2, R6.3).
 *
 * Anchors: R_fast (min time) and R_cool (min personal heat X). For an adjacent
 * pair (a, b) with T_a < T_b and X_a > X_b, the weight that makes the two
 * equal-cost is lambda = (T_b - T_a)/(X_a - X_b); minimising T + lambda*X finds
 * any supported point strictly below the segment a-b. Recurse on both halves.
 *
 * Candidates are deduped by edge-length overlap above o_max, yielding 2-5
 * routes. Blocked edges (Infinity cost) are never used (comes from edgeCost).
 */

import type { EngineRoute, PlanContext } from "./types.js";
import { astar, type CostFn } from "./astar.js";
import { evaluateRoute } from "./route.js";
import { edgeTime } from "./cost.js";
import { safety as safetyCfg, o_max } from "../config.js";

/** Weighted-sum arc cost: time + lambda * (pf * H * timeMinutes), with masking. */
function weightedCost(ctx: PlanContext, lambda: number): CostFn {
  const { snap, heat, safety, pf } = ctx;
  return (e: number) => {
    const S = safety[e]!;
    const isStep = snap.step[e] === 1;
    if (S > safetyCfg.S_hard) return Infinity;
    if (ctx.scenario.stepFree && isStep) return Infinity;
    const len = snap.len[e]!;
    const dt = edgeTime(len, isStep);
    const dtMin = dt / 60;
    return dt + lambda * pf * heat[e]! * dtMin;
  };
}

/** Admissible heuristic for the weighted cost: time lower bound only. */
function heuristicFor(ctx: PlanContext, to: number): (n: number) => number {
  const { snap } = ctx;
  const tx = snap.nodeX[to]!;
  const ty = snap.nodeY[to]!;
  const invV = ctx.cMin; // min cost per metre (time term); admissible lower bound
  return (n: number) => {
    const dx = tx - snap.nodeX[n]!;
    const dy = ty - snap.nodeY[n]!;
    return Math.sqrt(dx * dx + dy * dy) * invV * 0.995;
  };
}

function solve(ctx: PlanContext, from: number, to: number, lambda: number, A0: number): EngineRoute | null {
  const res = astar(ctx.graph, from, to, weightedCost(ctx, lambda), heuristicFor(ctx, to));
  if (!res.found) return null;
  return evaluateRoute(ctx, res.edges, res.nodes, A0);
}

/** Edge-length overlap fraction between two routes (symmetric, 0..1). */
function overlapFraction(a: EngineRoute, b: EngineRoute, snap: PlanContext["snap"]): number {
  const setA = new Set(a.edges);
  let shared = 0;
  for (const e of b.edges) if (setA.has(e)) shared += snap.len[e]!;
  const minLen = Math.min(a.distanceM, b.distanceM);
  return minLen > 0 ? shared / minLen : 0;
}

/**
 * Compute the supported frontier. Returns 2-5 non-dominated routes ordered from
 * fastest to coolest. `A0` seeds the exposure trace for metrics.
 */
export function frontier(ctx: PlanContext, from: number, to: number, A0: number): EngineRoute[] {
  // Anchors.
  const fast = solve(ctx, from, to, 0, A0); // pure time
  const cool = solve(ctx, from, to, 1e6, A0); // heat dominates
  if (!fast) return [];
  if (!cool) return [fast];

  const found: EngineRoute[] = [];
  const seen = new Set<string>();
  const keyOf = (r: EngineRoute) => `${r.timeSec.toFixed(2)}:${r.x.toFixed(4)}`;
  const push = (r: EngineRoute) => {
    const k = keyOf(r);
    if (!seen.has(k)) {
      seen.add(k);
      found.push(r);
    }
  };
  push(fast);
  push(cool);

  // Dichotomic recursion between anchors (bounded depth to cap route count).
  const MAX_ROUTES = 5;
  const recurse = (a: EngineRoute, b: EngineRoute, depth: number): void => {
    if (found.length >= MAX_ROUTES || depth > 4) return;
    const dT = b.timeSec - a.timeSec;
    const dX = a.x - b.x;
    if (dT <= 1e-6 || dX <= 1e-6) return; // not a proper trade-off segment
    const lambda = dT / dX;
    const mid = solve(ctx, from, to, lambda, A0);
    if (!mid) return;
    // Keep only if strictly below the a-b segment (a genuine new supported point).
    const segCostA = a.timeSec + lambda * a.x;
    const midCost = mid.timeSec + lambda * mid.x;
    if (midCost < segCostA - 1e-6) {
      push(mid);
      recurse(a, mid, depth + 1);
      recurse(mid, b, depth + 1);
    }
  };
  recurse(fast, cool, 0);

  // Order fastest -> coolest.
  found.sort((p, q) => p.timeSec - q.timeSec || p.x - q.x);

  // Dedupe by edge-length overlap > o_max, keeping the earlier (faster) one.
  const kept: EngineRoute[] = [];
  for (const r of found) {
    let dominated = false;
    for (const k of kept) {
      if (overlapFraction(r, k, ctx.snap) > o_max) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(r);
  }
  return kept.slice(0, MAX_ROUTES);
}
