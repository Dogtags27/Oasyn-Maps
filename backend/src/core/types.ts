/**
 * core/types.ts — shared engine types. Pure data; no behaviour.
 *
 * The `PlanContext` is the per-request bundle the engine threads through env ->
 * H/S -> pf -> frontier -> score. Building it once (O(E)) and reusing it keeps
 * the hot path allocation-free (R15.3).
 */

import type { Snapshot } from "../snapshot.js";
import type { GraphView } from "./graph.js";
import type { Mode } from "../config.js";

export type { Mode };

/** A resolved weather/world state for one request (time is an input, R-determinism). */
export interface ResolvedScenario {
  /** epoch ms of the scenario time (from timeISO). */
  timeMs: number;
  /** air temperature, deg C. */
  tempC: number;
  /** relative humidity, percent. */
  rh: number;
  /** cloud fraction [0,1]. */
  cloud: number;
  /** optional live shortwave radiation, W/m^2. */
  radiation?: number;
  /** prior walking minutes used to seed A0. */
  priorWalkMin: number;
  /** simulated heart rate, bpm (optional). */
  hr?: number;
  /** request step-free routing. */
  stepFree: boolean;
}

/** Environment scalars derived once per scenario. */
export interface EnvScalars {
  /** s = max(0, sin(sunAltitude)). */
  s: number;
  /** sun azimuth (radians). */
  azimuth: number;
  /** solar intensity I in [0,1]. */
  I: number;
  /** thermal load theta in [0,1]. */
  theta: number;
  /** apparent temperature, deg C. */
  appTemp: number;
}

/**
 * The per-request engine context. Static graph is shared; heat/safety are the
 * runtime arrays overwritten per scenario; scalars/pf are derived once.
 */
export interface PlanContext {
  snap: Snapshot;
  graph: GraphView;
  scenario: ResolvedScenario;
  env: EnvScalars;
  /** per-edge heat rate H in [0,1] (snap.heat, filled per scenario). */
  heat: Float32Array;
  /** per-edge safety field S in [0,1] (snap.safety, filled per scenario). */
  safety: Float32Array;
  /** personal factor pf >= 1. */
  pf: number;
  /** minimum per-edge cost per metre, for the admissible A* heuristic. */
  cMin: number;
  mode: Mode;
}

/** A computed route before serialisation to the contract RouteResult. */
export interface EngineRoute {
  edges: number[];
  nodes: number[];
  /** total walking time, seconds. */
  timeSec: number;
  /** total distance, metres. */
  distanceM: number;
  /** heat-minutes = integral of H over time, minutes. */
  heatMinutes: number;
  /** personal heat objective X used by the frontier (pf-weighted heat-minutes). */
  x: number;
  /** max safety value along the route. */
  safetyMax: number;
  /** fraction of distance that is shaded, [0,1]. */
  shadeFrac: number;
  /** arrival accumulated exposure A_T. */
  aEnd: number;
}
