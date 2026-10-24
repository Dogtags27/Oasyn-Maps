/**
 * core/scoring.ts — score and rank frontier candidates (R6.4, R6.5).
 *
 *   J = w_t * T/T_fast + w_h * X/X_fast + w_s * S(R)
 * where T_fast / X_fast are the fastest route's time / personal-heat, and S(R)
 * is the route's max safety. Candidates are filtered by the mode detour cap
 * (T <= rho * T_fast) and hard safety, then sorted by J (ties by first node id).
 *
 * The "coolest within cap" pick is a LARAC-style selection: among feasible
 * routes within the cap, the one with the lowest personal heat X. The MVP
 * duality-gap limitation of the Lagrangian frontier is documented in design §14.
 */

import type { EngineRoute, PlanContext } from "./types.js";
import { modeWeights, safety as safetyCfg } from "../config.js";

export interface ScoredRoute {
  route: EngineRoute;
  j: number;
  feasible: boolean;
}

/** Score + filter + rank. Returns scored routes ordered best (lowest J) first. */
export function rank(ctx: PlanContext, routes: EngineRoute[]): ScoredRoute[] {
  if (routes.length === 0) return [];
  const w = modeWeights[ctx.mode];

  // References from the fastest route (min time).
  const fastest = routes.reduce((a, b) => (b.timeSec < a.timeSec ? b : a));
  const tFast = Math.max(1e-6, fastest.timeSec);
  const xFast = Math.max(1e-6, fastest.x);
  const cap = w.rho * tFast;

  const scored: ScoredRoute[] = routes.map((route) => {
    const withinCap = route.timeSec <= cap + 1e-6;
    const hardOk = route.safetyMax <= safetyCfg.S_hard;
    const j = w.w_t * (route.timeSec / tFast) + w.w_h * (route.x / xFast) + w.w_s * route.safetyMax;
    return { route, j, feasible: withinCap && hardOk };
  });

  // Rank: feasible first, then by J, ties broken by the route's first node id.
  scored.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (Math.abs(a.j - b.j) > 1e-9) return a.j - b.j;
    return (a.route.nodes[0] ?? 0) - (b.route.nodes[0] ?? 0);
  });
  return scored;
}

export interface RouteMetrics {
  timeSec: number;
  personalHeat: number;
  safetyMax: number;
}

/**
 * Pairwise J for the reroute decision, both routes normalised by the SAME
 * reference (the candidate/optimal remaining route). Used by /api/replan to
 * compare the walker's committed remaining route against the optimal one:
 *
 *   J(r) = w_t * T_r/T_ref + w_h * X_r/X_ref + w_s * S_r
 *
 * With the candidate as the reference, J_candidate reduces to w_t + w_h + w_s*S,
 * and J_current >= J_candidate whenever the candidate is genuinely better.
 */
export function pairwiseJ(mode: PlanContext["mode"], r: RouteMetrics, ref: RouteMetrics): number {
  const w = modeWeights[mode];
  const tRef = Math.max(1e-6, ref.timeSec);
  const xRef = Math.max(1e-6, ref.personalHeat);
  return w.w_t * (r.timeSec / tRef) + w.w_h * (r.personalHeat / xRef) + w.w_s * r.safetyMax;
}

/**
 * Coolest route within the detour cap and hard safety (LARAC-style pick).
 *
 * LIMITATION (documented, R6.4): we select the coolest among the SUPPORTED
 * frontier points that satisfy the time cap. The Lagrangian/weighted-sum frontier
 * finds only *supported* Pareto-optimal routes (those on the lower convex hull of
 * the time-vs-heat trade-off). A constrained-shortest-path optimum can lie in a
 * duality gap — a non-supported point strictly better than any supported one
 * within the cap. We accept this gap for the MVP: the exact state-dependent search
 * over (node, bucket(A)) that would close it is a stretch item (math.md §5.4,
 * design §14). In practice the gap is small for walking graphs and this pick is a
 * close, fast approximation.
 */
export function coolestWithinCap(ctx: PlanContext, routes: EngineRoute[]): EngineRoute | null {
  if (routes.length === 0) return null;
  const w = modeWeights[ctx.mode];
  const tFast = Math.max(1e-6, routes.reduce((a, b) => (b.timeSec < a.timeSec ? b : a)).timeSec);
  const cap = w.rho * tFast;
  const feasible = routes.filter((r) => r.timeSec <= cap + 1e-6 && r.safetyMax <= safetyCfg.S_hard);
  if (feasible.length === 0) return null;
  // Lowest personal heat; ties by lower time, then first node id.
  return feasible.reduce((a, b) => {
    if (Math.abs(b.x - a.x) > 1e-9) return b.x < a.x ? b : a;
    if (Math.abs(b.timeSec - a.timeSec) > 1e-6) return b.timeSec < a.timeSec ? b : a;
    return (b.nodes[0] ?? 0) < (a.nodes[0] ?? 0) ? b : a;
  });
}
