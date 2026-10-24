/**
 * core/env.ts — environment model: shade and per-edge heat rate (R3).
 *
 * Pure and deterministic: time arrives as an input (timeMs); no Date / random.
 *
 * Heat rate:  H = theta * (k0 + (1 - k0) * I * (1 - alpha * sigma))
 *   theta — thermal load from apparent temperature, [0,1]
 *   I     — solar intensity, [0,1]
 *   sigma — per-edge shade (canopy ∪ building), [0,1]
 * Guarantees H in [0,1], dH/dI >= 0, dH/dsigma <= 0 (tested, R17.1).
 */

import SunCalc from "suncalc";
import {
  k0,
  alpha,
  shadeWeights,
  featureNorm,
  Q_max,
  T_lo,
  T_hi,
  sigmaMax,
  sunRampDeg,
  horizonShade,
} from "../config.js";
import type { EnvScalars, ResolvedScenario } from "./types.js";
import type { Snapshot } from "../snapshot.js";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

const TWO_PI = Math.PI * 2;
const RAD2DEG = 180 / Math.PI;

/**
 * Sun position from suncalc: altitude factor s = max(0, sin(altitude)), the raw
 * altitude, the suncalc azimuth (0 = south, +west), and the compass bearing
 * (clockwise from north) that the baked skyline is indexed by.
 */
export function sun(
  timeMs: number,
  lat: number,
  lon: number,
): { s: number; azimuth: number; altitude: number; bearing: number } {
  const pos = SunCalc.getPosition(new Date(timeMs), lat, lon);
  const bearing = (((pos.azimuth + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI;
  return { s: Math.max(0, Math.sin(pos.altitude)), azimuth: pos.azimuth, altitude: pos.altitude, bearing };
}

/** Direct-beam ramp in [0,1]: 0 at/below the horizon, 1 from sunRampDeg upward. */
export function sunRamp(altitudeRad: number): number {
  return clamp01((altitudeRad * RAD2DEG) / sunRampDeg);
}

/**
 * Solar intensity I in [0,1]. If live shortwave radiation is given, clamp by
 * Q_max; otherwise a simplified Kasten-Czeplak cloud attenuation: clear sky ~1,
 * overcast ~0.25.
 */
export function solarIntensity(cloud: number, radiation?: number): number {
  if (radiation !== undefined && radiation >= 0) {
    return clamp01(radiation / Q_max);
  }
  const c = clamp01(cloud);
  return clamp01(1 - 0.75 * c ** 3.4);
}

/**
 * Apparent temperature (deg C). Uses the NOAA Rothfusz heat index above the
 * low-HI threshold, with a simpler linear blend below it where Rothfusz is
 * unreliable. Input/output in Celsius; Rothfusz is defined in Fahrenheit.
 */
export function apparentTemp(tempC: number, rh: number): number {
  const T = (tempC * 9) / 5 + 32; // to Fahrenheit
  const R = clamp01(rh / 100) * 100;
  // Low-HI linear fallback (Steadman-style) when it's not hot enough for HI.
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + R * 0.094);
  let hiF: number;
  if ((simple + T) / 2 < 80) {
    hiF = simple;
  } else {
    // Rothfusz regression.
    hiF =
      -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      0.00683783 * T * T -
      0.05481717 * R * R +
      0.00122874 * T * T * R +
      0.00085282 * T * R * R -
      0.00000199 * T * T * R * R;
  }
  return ((hiF - 32) * 5) / 9; // back to Celsius
}

/** Thermal load theta = clamp((T_app - T_lo)/(T_hi - T_lo)) in [0,1]. */
export function thermalLoad(appTemp: number): number {
  return clamp01((appTemp - T_lo) / (T_hi - T_lo));
}

/** Canopy shade sigma_c from tree density and park openness, [0,1]. */
export function canopyShade(trees: number, park: number): number {
  return clamp01(shadeWeights.a1 * (trees / featureNorm.n_t) + shadeWeights.a2 * park);
}

/**
 * Per-edge shade sigma as the probabilistic union of canopy shade sigma_c and
 * building shade sigma_b: sigma = 1 - (1 - sigma_c)(1 - sigma_b).
 *   sigma_c from tree density and park openness.
 *   sigma_b from building proximity, scaled UP at low sun (long shadows).
 * Clamped to sigmaMax so H_min stays a valid lower bound.
 */
export function edgeShade(trees: number, park: number, bldg: number, s: number): number {
  const canopy = canopyShade(trees, park);
  // Low sun (small s) -> longer shadows -> more building shade. gain in [a3, 2*a3].
  const lowSunGain = shadeWeights.a3 * (1 + (1 - s));
  const building = clamp01(lowSunGain * (bldg / featureNorm.n_b));
  const sigma = 1 - (1 - canopy) * (1 - building);
  return Math.min(sigmaMax, clamp01(sigma));
}

/** Per-edge heat rate H in [0,1]. Monotone up in I, down in sigma. */
export function edgeHeat(theta: number, I: number, sigma: number): number {
  const H = theta * (k0 + (1 - k0) * I * (1 - alpha * sigma));
  return clamp01(H);
}

/** Lower bound on H across all edges (uses sigma_max), for the A* heuristic. */
export function heatMin(theta: number, I: number): number {
  return clamp01(theta * (k0 + (1 - k0) * I * (1 - alpha * sigmaMax)));
}

/** Resolve the per-scenario environment scalars once. */
export function resolveEnv(scenario: ResolvedScenario, center: { lat: number; lon: number }): EnvScalars {
  const { s, azimuth, altitude, bearing } = sun(scenario.timeMs, center.lat, center.lon);
  // Direct sun only exists when the sun is up: scale by the altitude ramp.
  const I = solarIntensity(scenario.cloud, scenario.radiation) * sunRamp(altitude);
  const appTemp = apparentTemp(scenario.tempC, scenario.rh);
  const theta = thermalLoad(appTemp);
  return { s, azimuth, altitude, bearing, I, theta, appTemp };
}

/**
 * Fill the snapshot's runtime `heat` array in O(E) for the given scenario (R3.7).
 * Mutates and returns snap.heat.
 *
 * With a baked skyline (snap.horizon) building shade is geometric: an edge is
 * shaded to the degree the sun sits below the skyline in the sun's direction.
 * Without one (older snapshots, hand-built test graphs) the legacy
 * building-proximity count is used.
 */
export function buildHeatArray(snap: Snapshot, env: EnvScalars): Float32Array {
  const { theta, I, s } = env;
  const heat = snap.heat;
  const hz = snap.horizon;

  if (hz && env.altitude !== undefined && env.bearing !== undefined) {
    const { bins, quantDeg, data } = hz;
    const altDeg = env.altitude * RAD2DEG;
    const fbin = (env.bearing * RAD2DEG) / (360 / bins);
    const fl = Math.floor(fbin);
    const b0 = ((fl % bins) + bins) % bins;
    const b1 = (b0 + 1) % bins;
    const w = fbin - fl;
    const w0 = (1 - w) * quantDeg;
    const w1 = w * quantDeg;
    const invSoft = 1 / (2 * horizonShade.softDeg);
    for (let e = 0; e < snap.E; e++) {
      const base = e * bins;
      const skylineDeg = w0 * data[base + b0]! + w1 * data[base + b1]!;
      const bShade = clamp01(0.5 + (skylineDeg - altDeg) * invSoft);
      const canopy = canopyShade(snap.trees[e]!, snap.park[e]!);
      const sigma = Math.min(sigmaMax, clamp01(1 - (1 - canopy) * (1 - bShade)));
      heat[e] = edgeHeat(theta, I, sigma);
    }
    return heat;
  }

  for (let e = 0; e < snap.E; e++) {
    const sigma = edgeShade(snap.trees[e]!, snap.park[e]!, snap.bldg[e]!, s);
    heat[e] = edgeHeat(theta, I, sigma);
  }
  return heat;
}
