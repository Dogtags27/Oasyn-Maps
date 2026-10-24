/**
 * core/body.ts — transparent core-temperature heuristic (R10.1-R10.3).
 *
 * Tc_model = Tc0 + k_A*A + k_HR*clamp((HR - HR_base)/HR_base, 0, 1)
 *
 * This is an ILLUSTRATIVE MODEL, not a medical reading (honesty principle). When
 * a simulated wearable is active, Tc_used is the (SIMULATED) observation; else
 * the model. If the observation exceeds the model by more than margin `m`, the
 * personal factor is raised by 1 + gamma*(delta/m), capped at pf_max, signalling
 * a reroute/break offer.
 *
 * Pure/deterministic; no Date / random.
 */

import { body as bodyCfg, gamma, m, pf_max } from "../config.js";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Modeled core temperature from accumulated exposure A and heart rate. */
export function tcModel(A: number, hr: number, hrBase: number = bodyCfg.HR_base): number {
  const hrTerm = hrBase > 0 ? clamp01((hr - hrBase) / hrBase) : 0;
  return bodyCfg.Tc0 + bodyCfg.k_A * Math.max(0, A) + bodyCfg.k_HR * hrTerm;
}

/** Reported +/- range around the model value (deg C). */
export function tcRange(tc: number): { low: number; high: number } {
  return { low: tc - bodyCfg.r, high: tc + bodyCfg.r };
}

export interface TcUsedInput {
  model: number;
  /** SIMULATED wearable observation, deg C. */
  obs?: number;
  wearableOn: boolean;
}

/** The core temperature the engine acts on: wearable obs when active, else model. */
export function tcUsed({ model, obs, wearableOn }: TcUsedInput): number {
  return wearableOn && obs !== undefined ? obs : model;
}

/**
 * Personal-factor uplift from an observed-vs-modeled discrepancy. Returns a
 * multiplier >= 1, capped at pf_max, and a flag for whether it crosses the
 * margin (which signals a reroute/break offer, R10.3).
 */
export function pfUplift(obs: number | undefined, model: number): { factor: number; triggered: boolean } {
  if (obs === undefined) return { factor: 1, triggered: false };
  const delta = obs - model;
  if (delta <= m) return { factor: 1, triggered: false };
  const factor = Math.min(pf_max, 1 + gamma * (delta / m));
  return { factor, triggered: true };
}
