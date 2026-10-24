/**
 * core/route.ts — evaluate an edge path into engine metrics.
 *
 * One place computes time, distance, heat-minutes, the frontier objective X
 * (pf-weighted heat-minutes), max safety, shade fraction, and arrival exposure.
 * Both the frontier and scoring reuse this so metrics never drift.
 */

import type { EngineRoute, PlanContext } from "./types.js";
import { edgeTime } from "./cost.js";
import { stepA } from "./exposure.js";
import { edgeShade } from "./env.js";
import { tau } from "../config.js";

/** Build an EngineRoute from an ordered edge list, given the per-edge arc nodes. */
export function evaluateRoute(ctx: PlanContext, edges: number[], nodes: number[], A0: number): EngineRoute {
  const { snap, heat, safety, pf, env } = ctx;
  let timeSec = 0;
  let distanceM = 0;
  let heatMinutes = 0;
  let x = 0;
  let safetyMax = 0;
  let shadedDist = 0;
  let A = A0;

  for (const e of edges) {
    const len = snap.len[e]!;
    const isStep = snap.step[e] === 1;
    const dt = edgeTime(len, isStep);
    const H = heat[e]!;
    const S = safety[e]!;

    const dtMin = dt / 60;
    timeSec += dt;
    distanceM += len;
    heatMinutes += H * dtMin;
    x += pf * H * dtMin; // frontier "personal heat" objective
    if (S > safetyMax) safetyMax = S;

    // shade fraction: reconstruct sigma for this edge (cheap, deterministic).
    const sigma = edgeShade(snap.trees[e]!, snap.park[e]!, snap.bldg[e]!, env.s);
    shadedDist += sigma * len;

    A = stepA(A, H, dt, tau);
  }

  return {
    edges,
    nodes,
    timeSec,
    distanceM,
    heatMinutes,
    x,
    safetyMax,
    shadeFrac: distanceM > 0 ? shadedDist / distanceM : 0,
    aEnd: A,
  };
}
