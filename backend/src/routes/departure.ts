/**
 * routes/departure.ts — real POST /api/departure (R12.3, R13.2).
 *
 * Returns the heat-minutes-vs-departure-time curve and the best window. No stub
 * header. The safety array is built once (zones are fixed across the day); only
 * H is rebuilt per sampled time inside departureCurve.
 */

import type { Request, Response } from "express";
import { DepartureRequest, DepartureResponse, type Scenario } from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import type { ResolvedScenario } from "../core/types.js";
import { buildGraphView, type GraphView } from "../core/graph.js";
import { buildSafetyArray } from "../core/safety.js";
import { departureCurve } from "../core/departure.js";
import { noPath as noPathDesc } from "../core/descriptors.js";
import { zodToApiError, sendError } from "./error.js";

const isDev = process.env.NODE_ENV !== "production";

function resolveScenario(s: Scenario): ResolvedScenario {
  return {
    timeMs: Date.parse(s.timeISO),
    tempC: s.tempC, rh: s.rh, cloud: s.cloud, radiation: s.radiation,
    priorWalkMin: s.priorWalkMin, hr: s.hr, stepFree: s.stepFree,
  };
}

export function makeDepartureRoute(snap: Snapshot) {
  const graph: GraphView = buildGraphView(snap);
  return (req: Request, res: Response): void => {
    const parsed = DepartureRequest.safeParse(req.body);
    if (!parsed.success) {
      const body = zodToApiError(parsed.error);
      res.status(body.status).json(body);
      return;
    }
    try {
      const { from, to, mode, scenario } = parsed.data;
      const resolved = resolveScenario(scenario);

      const fromNode = graph.snapNode(from.lat, from.lng);
      const toNode = graph.snapNode(to.lat, to.lng);
      if (fromNode < 0 || toNode < 0) {
        res.status(422).json({ error: true, status: 422, code: "NO_PATH", message: noPathDesc() });
        return;
      }

      // Safety is fixed across the day; build once.
      const safety = buildSafetyArray(snap, scenario.zones, snap.center);

      const curve = departureCurve({
        snap, graph, baseScenario: resolved, safety, mode, from: fromNode, to: toNode,
      });

      const payload = {
        points: curve.points.map((p) => ({ tISO: new Date(p.timeMs).toISOString(), heatMin: p.heatMin })),
        best: { tISO: new Date(curve.best.timeMs).toISOString(), reductionPct: curve.best.reductionPct },
      };
      res.json(isDev ? DepartureResponse.parse(payload) : payload);
    } catch (err) {
      sendError(res, err);
    }
  };
}
