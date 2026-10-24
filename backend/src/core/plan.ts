/**
 * core/plan.ts — the plan pipeline orchestrator (R1, R6). Pure and deterministic.
 *
 * env -> H/S arrays -> pf -> snap -> frontier -> score -> turns -> explanations.
 * Returns a structured result the route layer serialises to PlanResponse. The
 * via-stop guard (R9) and backward-tree caching (R8/R15) are wired in Hour 4;
 * clear seams are left here.
 *
 * Safety retry (R7.4): if hard-safety masking disconnects start and goal, the
 * caller re-runs with `dropSafetyMask: true` and surfaces a warning descriptor.
 */

import type { Snapshot } from "../snapshot.js";
import type { GraphView } from "./graph.js";
import type { EngineRoute, PlanContext, ResolvedScenario } from "./types.js";
import type { Mode } from "../config.js";
import type { Zone, Descriptor } from "../../contract/schemas.js";
import { resolveEnv, buildHeatArray, heatMin } from "./env.js";
import { buildSafetyArray } from "./safety.js";
import { personalFactor, minCostPerMetre } from "./cost.js";
import { initA0 } from "./exposure.js";
import { frontier } from "./frontier.js";
import { rank, coolestWithinCap, type ScoredRoute } from "./scoring.js";
import { turnsFor } from "./turns.js";
import { explain } from "./explain.js";
import { modeWeights, body as bodyCfg, safety as safetyCfg } from "../config.js";

export interface PlanInput {
  snap: Snapshot;
  graph: GraphView;
  scenario: ResolvedScenario;
  zones: Zone[];
  mode: Mode;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

export interface PlanOutput {
  routes: ScoredRoute[];
  recommended: EngineRoute | null;
  /** turns keyed by the recommended route only (others on demand). */
  turnsByRoute: Map<EngineRoute, ReturnType<typeof turnsFor>>;
  explanations: Descriptor[];
  noPath: boolean;
  /** true if the hard-safety mask had to be dropped to connect start and goal. */
  safetyMaskDropped: boolean;
  ctx: PlanContext;
}

/** Build the per-request context once (O(E) for H and S). */
function buildContext(input: PlanInput): PlanContext {
  const { snap, graph, scenario, zones, mode } = input;
  const env = resolveEnv(scenario, snap.center);
  const heat = buildHeatArray(snap, env);
  const safety = buildSafetyArray(snap, zones, snap.center);

  // A0 from prior walking minutes under unshaded conditions (I at this scenario).
  const hPrior = heatMin(env.theta, env.I);
  const A0 = initA0(hPrior, scenario.priorWalkMin);
  const pf = personalFactor({ A0, hr: scenario.hr, hrBase: bodyCfg.HR_base });

  const ctx: PlanContext = {
    snap,
    graph,
    scenario,
    env,
    heat,
    safety,
    pf,
    cMin: 0, // set below
    mode,
  };
  ctx.cMin = minCostPerMetre(ctx);
  return ctx;
}

/** Run the plan. `A0` is recomputed inside for both current and fresh rankings. */
export function plan(input: PlanInput): PlanOutput {
  const ctx = buildContext(input);
  const { snap, graph, scenario } = ctx;

  const from = graph.snapNode(input.from.lat, input.from.lng);
  const to = graph.snapNode(input.to.lat, input.to.lng);

  const empty = (): PlanOutput => ({
    routes: [],
    recommended: null,
    turnsByRoute: new Map(),
    explanations: [],
    noPath: true,
    safetyMaskDropped: false,
    ctx,
  });

  if (from < 0 || to < 0) return empty();

  // A0 for the walker (same as used in pf).
  const hPrior = heatMin(ctx.env.theta, ctx.env.I);
  const A0 = initA0(hPrior, scenario.priorWalkMin);

  // Frontier with hard-safety masking (R7.3).
  let routes = frontier(ctx, from, to, A0);
  let safetyMaskDropped = false;

  // Retry without the mask if masking disconnected start and goal (R7.4).
  if (routes.length === 0 && hasActiveSafety(ctx)) {
    const relaxed: PlanContext = { ...ctx, safety: new Float32Array(snap.E) };
    routes = frontier(relaxed, from, to, A0);
    if (routes.length > 0) safetyMaskDropped = true;
  }

  if (routes.length === 0) return empty();

  const scored = rank(ctx, routes);
  const recommended = chooseRecommended(ctx, scored, routes);
  const recommendedKey = recommended ? routeKey(recommended) : "";

  // Fresh-walker ranking (A0 = 0) for the "changed vs fresh" explanation (R11.2).
  // PERF: skip the second frontier when the walker IS already fresh (no prior
  // minutes and no elevated HR) — then the fresh ranking equals the actual one,
  // so the explanation can never fire and the extra search is pure waste.
  const walkerIsFresh =
    scenario.priorWalkMin <= 0 &&
    (scenario.hr === undefined || scenario.hr <= bodyCfg.HR_base);
  let freshKey = recommendedKey;
  if (!walkerIsFresh) {
    const freshCtx: PlanContext = {
      ...ctx,
      pf: personalFactor({ A0: 0, hr: undefined, hrBase: bodyCfg.HR_base }),
    };
    const freshRoutes = frontier(freshCtx, from, to, 0);
    const freshScored = rank(freshCtx, freshRoutes);
    freshKey = freshScored[0] ? routeKey(freshScored[0].route) : recommendedKey;
  }

  const fastest = routes.reduce((a, b) => (b.timeSec < a.timeSec ? b : a));
  const explanations = recommended
    ? explain({
        recommended,
        fastest,
        recommendedKey,
        freshRecommendedKey: freshKey,
        capPct: (modeWeights[ctx.mode].rho - 1) * 100,
        safetyBlocked: safetyMaskDropped,
      })
    : [];

  const turnsByRoute = new Map<EngineRoute, ReturnType<typeof turnsFor>>();
  if (recommended) turnsByRoute.set(recommended, turnsFor(ctx, recommended.nodes));

  return { routes: scored, recommended, turnsByRoute, explanations, noPath: false, safetyMaskDropped, ctx };
}

function chooseRecommended(ctx: PlanContext, scored: ScoredRoute[], routes: EngineRoute[]): EngineRoute | null {
  if (ctx.mode === "coolest") {
    return coolestWithinCap(ctx, routes) ?? scored[0]?.route ?? null;
  }
  return scored.find((s) => s.feasible)?.route ?? scored[0]?.route ?? null;
}

/** Stable key identifying a route by its edge sequence. */
export function routeKey(r: EngineRoute): string {
  return r.edges.join(",");
}

function hasActiveSafety(ctx: PlanContext): boolean {
  for (let e = 0; e < ctx.snap.E; e++) if (ctx.safety[e]! > safetyCfg.S_hard) return true;
  return false;
}
