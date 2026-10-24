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

/** Coolest route within the detour cap and hard safety (LARAC-style pick). */
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
