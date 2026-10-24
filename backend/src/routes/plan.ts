/**
 * routes/plan.ts — real POST /api/plan (R1, R6.6, R13.2). Checkpoint 1.
 *
 * validate -> resolve scenario -> run engine pipeline -> serialise PlanResponse
 * -> validate in dev -> send (no stub header). Structured no-path result on
 * failure; never throws to the client (R1.5).
 */

import type { Request, Response } from "express";
import {
  PlanRequest,
  PlanResponse,
  type RouteResult,
  type Scenario,
} from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import { buildGraphView, type GraphView } from "../core/graph.js";
import { plan, routeKey } from "../core/plan.js";
import type { EngineRoute, ResolvedScenario } from "../core/types.js";
import { aTrace, band, initA0 } from "../core/exposure.js";
import { heatMin } from "../core/env.js";
import { edgeTime } from "../core/cost.js";
import { noPath as noPathDesc, warnSafetyMaskDropped } from "../core/descriptors.js";
import { viaStops } from "../core/cooling.js";
import { loadResources } from "./resources.js";
import type { Offer } from "../../contract/schemas.js";
import { zodToApiError, sendError } from "./error.js";

const isDev = process.env.NODE_ENV !== "production";

function resolveScenario(s: Scenario): ResolvedScenario {
  return {
    timeMs: Date.parse(s.timeISO),
    tempC: s.tempC,
    rh: s.rh,
    cloud: s.cloud,
    radiation: s.radiation,
    priorWalkMin: s.priorWalkMin,
    hr: s.hr,
    stepFree: s.stepFree,
  };
}

/** Serialise an EngineRoute to the contract RouteResult. */
function toRouteResult(
  snap: Snapshot,
  r: EngineRoute,
  mode: RouteResult["mode"],
  j: number,
  feasible: boolean,
  turns: RouteResult["turns"],
  explanations: RouteResult["explanations"],
  A0: number,
  env: { theta: number; I: number; s: number },
): RouteResult {
  // Per-edge durations and heats for the trace.
  const dts: number[] = [];
  const hs: number[] = [];
  const lens: number[] = [];
  for (const e of r.edges) {
    const isStep = snap.step[e] === 1;
    dts.push(edgeTime(snap.len[e]!, isStep));
    hs.push(snap.heat[e]!);
    lens.push(snap.len[e]!);
  }
  const trace = aTrace(A0, dts, hs, lens);

  const geometry = r.nodes.map((n) => ({ lat: snap.nodeLat[n]!, lng: snap.nodeLon[n]! }));

  return {
    id: `route-${routeKey(r).length}-${Math.round(r.timeSec)}-${Math.round(r.x * 1000)}`,
    mode,
    geometry,
    timeSec: r.timeSec,
    distanceM: r.distanceM,
    heatMinutes: r.heatMinutes,
    shadePct: r.shadeFrac * 100,
    arrivalBand: band(r.aEnd),
    safetyMax: r.safetyMax,
    oases: [],
    j,
    feasible,
    turns,
    aTrace: trace,
    explanations,
  };
}

/** Factory: returns a POST /api/plan handler bound to the loaded snapshot. */
export function makePlanRoute(snap: Snapshot) {
  const graph: GraphView = buildGraphView(snap);
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = PlanRequest.safeParse(req.body);
    if (!parsed.success) {
      const body = zodToApiError(parsed.error);
      res.status(body.status).json(body);
      return;
    }
    try {
      const { from, to, mode, scenario } = parsed.data;
      const resolved = resolveScenario(scenario);
      const out = plan({ snap, graph, scenario: resolved, zones: scenario.zones, mode, from, to });

      if (out.noPath || !out.recommended) {
        const body = PlanResponse.parse({
          routes: [],
          recommendedId: null,
          noPath: noPathDesc(),
          offers: [],
        });
        res.json(body);
        return;
      }

      const env = out.ctx.env;
      const A0 = initA0(heatMin(env.theta, env.I), resolved.priorWalkMin);

      const recommended = out.recommended;
      const results: RouteResult[] = out.routes.map((s) => {
        const isRec = s.route === recommended;
        const turns = isRec ? (out.turnsByRoute.get(s.route) ?? []) : [];
        const explanations = isRec ? out.explanations : [];
        return toRouteResult(snap, s.route, mode, s.j, s.feasible, turns, explanations, A0, env);
      });

      const recommendedId =
        results.find((rr, i) => out.routes[i]!.route === recommended)?.id ?? null;

      // Via-stop guard (R9.3): only when projected arrival exposure is high.
      const offers: Offer[] = [];
      if (recommended && band(recommended.aEnd) === "high") {
        const fromNode = graph.snapNode(from.lat, from.lng);
        const toNode = graph.snapNode(to.lat, to.lng);
        const resources = await loadResources(snap, graph);
        const via = viaStops(out.ctx, fromNode, toNode, resources, recommended, A0, resolved.timeMs);
        if (via) offers.push(via.offer);
      }

      const body = {
        routes: results,
        recommendedId,
        offers,
        ...(out.safetyMaskDropped ? { warning: warnSafetyMaskDropped() } : {}),
      };

      // Validate the response in dev to catch contract drift early (R13.2).
      const checked = isDev ? PlanResponse.parse(body) : body;
      res.json(checked);
    } catch (err) {
      sendError(res, err);
    }
  };
}
