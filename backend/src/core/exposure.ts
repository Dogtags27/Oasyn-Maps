/**
 * core/exposure.ts — accumulated exposure as a leaky integrator (R4).
 *
 * Exact closed-form update across an edge traversed in dt seconds at heat rate H:
 *   A' = A*e^(-dt/tau) + H*tau*(1 - e^(-dt/tau))     ... but see note below.
 *
 * NOTE on units: we model A as a dimensionless exposure in [0, 1]-ish scaled so
 * that steady exposure at rate H converges to A -> H (not H*tau). The leaky
 * integrator with input H is:
 *   dA/dt = (H - A)/tau   =>   A' = A*e^(-dt/tau) + H*(1 - e^(-dt/tau))
 * This keeps A bounded by max H (R17.1: A <= H*tau in the spec's scaling; here
 * A <= max H over the path), decays to 0 when H = 0, and is path-dependent.
 *
 * Pure/deterministic. No Euler integration — the closed form is exact (R4.1).
 */

import { tau, bands, walkSpeedMps } from "../config.js";
import type { ExposureBand } from "../../contract/schemas.js";

/** Exact leaky-integrator step. dt seconds, heat rate H. */
export function stepA(A: number, H: number, dt: number, tauSec: number = tau): number {
  const decay = Math.exp(-dt / tauSec);
  return A * decay + H * (1 - decay);
}

/**
 * Initialise A0 from prior walking minutes P under unshaded conditions.
 * Starts from zero and integrates at the prior heat rate H_p for P minutes.
 */
export function initA0(H_p: number, priorMin: number, tauSec: number = tau): number {
  return stepA(0, H_p, priorMin * 60, tauSec);
}

/** A cooling/recovery dwell of `durationSec` at reduced rate H_r (default 0). */
export function dwellA(A: number, durationSec: number, H_r = 0, tauSec: number = tau): number {
  return stepA(A, H_r, durationSec, tauSec);
}

/** Walking time (seconds) for an edge of `lenM` metres, with optional step penalty. */
export function edgeTimeSec(lenM: number, stepMultiplier = 1): number {
  return (lenM / walkSpeedMps) * stepMultiplier;
}

/**
 * Arrival exposure A_T along a path. Each edge contributes its exact step; the
 * late-exposure weighting e^(-(T - t_i)/tau) is inherent to the recursive closed
 * form (earlier exposure decays by arrival), so A_T here IS the path-dependent,
 * non-additive arrival value (R4.4).
 *
 * @param A0    initial exposure
 * @param dts   per-edge durations (seconds)
 * @param hs    per-edge heat rates
 */
export function arrivalExposure(A0: number, dts: number[], hs: number[], tauSec: number = tau): number {
  let A = A0;
  for (let i = 0; i < dts.length; i++) {
    A = stepA(A, hs[i]!, dts[i]!, tauSec);
  }
  return A;
}

/**
 * Exposure trace: triples [timeSec, distanceM, A] at each node along the path,
 * so the frontend can animate without recomputing (R4.6).
 */
export function aTrace(
  A0: number,
  dts: number[],
  hs: number[],
  lens: number[],
  tauSec: number = tau,
): Array<[number, number, number]> {
  const trace: Array<[number, number, number]> = [[0, 0, A0]];
  let A = A0;
  let t = 0;
  let d = 0;
  for (let i = 0; i < dts.length; i++) {
    A = stepA(A, hs[i]!, dts[i]!, tauSec);
    t += dts[i]!;
    d += lens[i]!;
    trace.push([t, d, A]);
  }
  return trace;
}

/** Classify A into modeled bands (labelled modeled, not medical) (R4.5). */
export function band(A: number): ExposureBand {
  if (A < bands.b1) return "low";
  if (A < bands.b2) return "elevated";
  return "high";
}
