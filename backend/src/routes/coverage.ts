/**
 * routes/coverage.ts — real POST /api/coverage (R12.1, R12.2, R13.2).
 *
 * Multi-source nearest-oasis distances + within-5/10-minute shares, plus greedy
 * max-coverage site suggestions (labelled a heuristic). No stub header.
 *
 * Samples are thinned for display (the full per-node array is ~200k entries;
 * the frontend only needs a representative scatter).
 */

import type { Request, Response } from "express";
import { CoverageRequest, CoverageResponse, type Scenario } from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import type { ResolvedScenario, PlanContext } from "../core/types.js";
import { buildGraphView, type GraphView } from "../core/graph.js";
import { resolveEnv, buildHeatArray } from "../core/env.js";
import { buildSafetyArray } from "../core/safety.js";
import { minCostPerMetre } from "../core/cost.js";
import { oasisCoverage, suggestSites } from "../core/coverage.js";
import { loadResources } from "./resources.js";
import { d } from "../core/descriptors.js";
import { zodToApiError, sendError } from "./error.js";

const isDev = process.env.NODE_ENV !== "production";
const MAX_SAMPLES = 400; // thin the per-node distances for display

function resolveScenario(s: Scenario): ResolvedScenario {
  return {
    timeMs: Date.parse(s.timeISO),
    tempC: s.tempC, rh: s.rh, cloud: s.cloud, radiation: s.radiation,
    priorWalkMin: s.priorWalkMin, hr: s.hr, stepFree: s.stepFree,
  };
}

export function makeCoverageRoute(snap: Snapshot) {
  const graph: GraphView = buildGraphView(snap);
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = CoverageRequest.safeParse(req.body);
    if (!parsed.success) {
      const body = zodToApiError(parsed.error);
      res.status(body.status).json(body);
      return;
    }
    try {
      const { scenario, suggestK } = parsed.data;
      const resolved = resolveScenario(scenario);
      const env = resolveEnv(resolved, snap.center);
      buildHeatArray(snap, env);
      buildSafetyArray(snap, scenario.zones, snap.center);

      const ctx: PlanContext = {
        snap, graph, scenario: resolved, env,
        heat: snap.heat, safety: snap.safety, pf: 1, cMin: 0, mode: "fastest",
      };
      ctx.cMin = minCostPerMetre(ctx);

      const resources = await loadResources(snap, graph);
      const oasisNodes = resources.map((r) => r.node);

      const result = oasisCoverage(ctx, oasisNodes);
      const suggestions = suggestSites(ctx, oasisNodes, suggestK);

      // Thin per-node distances to a display scatter (deterministic stride).
      const stride = Math.max(1, Math.floor(snap.V / MAX_SAMPLES));
      const samples: Array<{ at: { lat: number; lng: number }; minutes: number }> = [];
      for (let i = 0; i < snap.V; i += stride) {
        const dsec = result.dMin[i]!;
        if (!Number.isFinite(dsec)) continue;
        samples.push({ at: { lat: snap.nodeLat[i]!, lng: snap.nodeLon[i]! }, minutes: dsec / 60 });
      }

      const payload = {
        within5Pct: result.within5 * 100,
        within10Pct: result.within10 * 100,
        samples,
        suggestions: suggestions.map((s, i) => ({
          at: { lat: snap.nodeLat[s.node]!, lng: snap.nodeLon[s.node]! },
          label: d("coverage.suggestion", { rank: i + 1 }),
          benefit: s.benefit,
        })),
        heuristicNote: d("coverage.heuristicNote"),
      };
      res.json(isDev ? CoverageResponse.parse(payload) : payload);
    } catch (err) {
      sendError(res, err);
    }
  };
}
