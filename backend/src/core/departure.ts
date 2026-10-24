/**
 * core/departure.ts — across-day departure planner (R12.3).
 *
 * Samples the best route in `stepMin` increments across a day. At each departure
 * time the sun position (and thus H) changes, so we re-resolve the environment,
 * rebuild the heat array, and run one frontier; the best route's heat-minutes is
 * the sample. Returns the curve plus the argmin window and its reduction vs the
 * worst sampled time.
 *
 * Pure/deterministic: all times are inputs derived from the base scenario time.
 */

import type { PlanContext, ResolvedScenario } from "./types.js";
import type { Snapshot } from "../snapshot.js";
import type { GraphView } from "./graph.js";
import type { Mode } from "../config.js";
import { resolveEnv, buildHeatArray, heatMin } from "./env.js";
import { personalFactor, minCostPerMetre } from "./cost.js";
import { initA0 } from "./exposure.js";
import { frontier } from "./frontier.js";
import { departure as depCfg, body as bodyCfg } from "../config.js";

export interface DeparturePoint {
  /** departure time, epoch ms. */
  timeMs: number;
  /** best-route heat-minutes at this departure time. */
  heatMin: number;
}

export interface DepartureCurve {
  points: DeparturePoint[];
  best: { timeMs: number; reductionPct: number };
}

export interface DepartureInput {
  snap: Snapshot;
  graph: GraphView;
  baseScenario: ResolvedScenario;
  safety: Float32Array; // prebuilt safety array (zones don't change across the day)
  mode: Mode;
  from: number; // snapped start node
  to: number; // snapped goal node
  /** number of samples across the day; defaults to a full 24h at stepMin. */
  samples?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function departureCurve(input: DepartureInput): DepartureCurve {
  const { snap, graph, baseScenario, safety, mode, from, to } = input;
  const stepMs = depCfg.stepMin * 60 * 1000;
  const n = input.samples ?? Math.floor(DAY_MS / stepMs);

  // Sweep from the start of the base scenario's day.
  const dayStart = Math.floor(baseScenario.timeMs / DAY_MS) * DAY_MS;

  const points: DeparturePoint[] = [];
  for (let i = 0; i < n; i++) {
    const timeMs = dayStart + i * stepMs;
    const scenario: ResolvedScenario = { ...baseScenario, timeMs };
    const env = resolveEnv(scenario, snap.center);
    buildHeatArray(snap, env);
    const A0 = initA0(heatMin(env.theta, env.I), scenario.priorWalkMin);
    const pf = personalFactor({ A0, hr: scenario.hr, hrBase: bodyCfg.HR_base });

    const ctx: PlanContext = {
      snap, graph, scenario, env,
      heat: snap.heat, safety, pf, cMin: 0, mode,
    };
    ctx.cMin = minCostPerMetre(ctx);

    const routes = frontier(ctx, from, to, A0);
    const bestHeat = routes.length
      ? Math.min(...routes.map((r) => r.heatMinutes))
      : Infinity;
    points.push({ timeMs, heatMin: Number.isFinite(bestHeat) ? bestHeat : 0 });
  }

  // argmin window + reduction vs the worst sampled heat-minutes.
  let bestIdx = 0;
  let worst = -Infinity;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.heatMin < points[bestIdx]!.heatMin) bestIdx = i;
    if (points[i]!.heatMin > worst) worst = points[i]!.heatMin;
  }
  const bestHeat = points[bestIdx]?.heatMin ?? 0;
  const reductionPct = worst > 0 ? ((worst - bestHeat) / worst) * 100 : 0;

  return {
    points,
    best: { timeMs: points[bestIdx]?.timeMs ?? baseScenario.timeMs, reductionPct },
  };
}
