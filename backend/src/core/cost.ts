/**
 * core/cost.ts — personal factor and additive edge cost (R5).
 *
 * All terms non-negative so Dijkstra/A* stay correct (R5.5): recovery is a node
 * dwell event, never a negative edge.
 *
 *   pf   = 1 + c_A*A0 + c_HR*clamp((HR-HRbase)/HRbase, 0, 1) + bodyDelta   (<= pf_max)
 *   c_e  = w_t*dt + w_h*pf*H*dt + w_s*S*len/100
 *   c_e  = Infinity  if S > S_hard, or (stepFree and edge is a step)
 */

import {
  personalFactor as pfCfg,
  pf_max,
  safety as safetyCfg,
  walkSpeedMps,
  stepMultiplier,
  modeWeights as MODE_WEIGHTS,
} from "../config.js";
import type { PlanContext } from "./types.js";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface PersonalFactorInput {
  /** accumulated exposure A0. */
  A0: number;
  /** simulated heart rate, bpm (optional). */
  hr?: number;
  /** baseline heart rate, bpm. */
  hrBase: number;
  /** body-temperature uplift delta (additive, from body model); default 0. */
  bodyDelta?: number;
}

/** Scalar re-weighting of heat vs time from the walker's modeled state (R5.2). */
export function personalFactor({ A0, hr, hrBase, bodyDelta = 0 }: PersonalFactorInput): number {
  const hrTerm = hr !== undefined && hrBase > 0 ? clamp01((hr - hrBase) / hrBase) : 0;
  const pf = 1 + pfCfg.c_A * Math.max(0, A0) + pfCfg.c_HR * hrTerm + Math.max(0, bodyDelta);
  return Math.min(pf_max, pf);
}

/** Walking time (seconds) for an edge, applying the step multiplier on stairs. */
export function edgeTime(lenM: number, isStep: boolean): number {
  return (lenM / walkSpeedMps) * (isStep ? stepMultiplier : 1);
}

/**
 * Additive edge cost for a given mode's weights. Returns Infinity when the edge
 * is hard-unsafe (R5.4) or is a step and step-free routing is requested.
 */
export function edgeCost(ctx: PlanContext, edge: number): number {
  const { snap, heat, safety, pf, mode } = ctx;
  const S = safety[edge]!;
  const isStep = snap.step[edge] === 1;
  if (S > safetyCfg.S_hard) return Infinity;
  if (ctx.scenario.stepFree && isStep) return Infinity;

  const weights = modeWeightsFor(ctx);
  const len = snap.len[edge]!;
  const dt = edgeTime(len, isStep);
  const H = heat[edge]!;
  const cost = weights.w_t * dt + weights.w_h * pf * H * dt + weights.w_s * S * (len / 100);
  return cost;
}

/** Resolve the active mode's weights from config via the context. */
export function modeWeightsFor(ctx: PlanContext): { w_t: number; w_h: number; w_s: number; rho: number } {
  return MODE_WEIGHTS[ctx.mode];
}

/** Minimum cost per metre across modes/edges, for the admissible A* heuristic. */
export function minCostPerMetre(ctx: PlanContext): number {
  const weights = modeWeightsFor(ctx);
  // Lower bound: the time term alone (heat/safety terms are non-negative).
  // Per metre: w_t * (1 / v).  Step edges only increase cost, so flat speed is a bound.
  return (weights.w_t * 1) / walkSpeedMps;
}

export { clamp01 };
