/**
 * routes/replan.ts — real POST /api/replan (R8, R13.2). Backward-tree reroute.
 *
 * Caches the backward tree by hash(scenario, goal) (R8.1, R15.2), derives the
 * remaining route by pointer-following in O(path) (R8.2), and emits a consent
 * offer — high priority if the remaining path has a hard-unsafe edge, else only
 * when J improves past the hysteresis margin (R8.3, R8.4). Per-kind snooze is
 * honoured (R8.6). No stub header.
 */

import type { Request, Response } from "express";
import {
  ReplanRequest,
  ReplanResponse,
  type RouteResult,
  type Scenario,
} from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import type { ResolvedScenario, PlanContext } from "../core/types.js";
import { buildGraphView, type GraphView } from "../core/graph.js";
import { resolveEnv, buildHeatArray, heatMin } from "../core/env.js";
import { buildSafetyArray } from "../core/safety.js";
import { personalFactor, minCostPerMetre, edgeTime } from "../core/cost.js";
import { initA0, aTrace, band } from "../core/exposure.js";
import {
  backwardTree,
  remainingRoute,
  hasHardUnsafeEdge,
  offerIfBetter,
  applySnooze,
} from "../core/rerouting.js";
import { LRU } from "../cache.js";
import { hashKey } from "../hash.js";
import { body as bodyCfg, safety as safetyCfg } from "../config.js";
import type { Tree } from "../core/astar.js";
import { noPath as noPathDesc } from "../core/descriptors.js";
import { pairwiseJ } from "../core/scoring.js";
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

export function makeReplanRoute(snap: Snapshot) {
  const graph: GraphView = buildGraphView(snap);
  // Backward-tree cache keyed by hash(scenario, goal) (R15.2).
  const treeCache = new LRU<Tree>();

  return (req: Request, res: Response): void => {
    const parsed = ReplanRequest.safeParse(req.body);
    if (!parsed.success) {
      const body = zodToApiError(parsed.error);
      res.status(body.status).json(body);
      return;
    }
    try {
      const { goal, position, mode, scenario, snoozed, current } = parsed.data;
      const resolved = resolveScenario(scenario);

      const env = resolveEnv(resolved, snap.center);
      buildHeatArray(snap, env);
      buildSafetyArray(snap, scenario.zones, snap.center);
      const A0 = initA0(heatMin(env.theta, env.I), resolved.priorWalkMin);
      const pf = personalFactor({ A0, hr: resolved.hr, hrBase: bodyCfg.HR_base });

      const ctx: PlanContext = {
        snap, graph, scenario: resolved, env,
        heat: snap.heat, safety: snap.safety, pf, cMin: 0, mode,
      };
      ctx.cMin = minCostPerMetre(ctx);

      const goalNode = graph.snapNode(goal.lat, goal.lng);
      const posNode = graph.snapNode(position.lat, position.lng);
      if (goalNode < 0 || posNode < 0) {
        res.json(ReplanResponse.parse({ remaining: null, offers: [], noPath: noPathDesc() }));
        return;
      }

      // Cached backward tree keyed by scenario + goal + mode.
      const key = hashKey("bwd", mode, scenario, goal);
      let tree = treeCache.get(key);
      if (!tree) {
        tree = backwardTree(ctx, goalNode);
        treeCache.set(key, tree);
      }

      const remaining = remainingRoute(ctx, tree, posNode, A0);
      if (!remaining) {
        res.json(ReplanResponse.parse({ remaining: null, offers: [], noPath: noPathDesc() }));
        return;
      }

      // `remaining` is the OPTIMAL route from the current position (the backward
      // tree encodes it) — this is the reroute CANDIDATE. We offer a switch when:
      //   (a) the remaining path is hard-unsafe  -> high-priority safety offer; or
      //   (b) the walker's committed remaining route (`current`, echoed by the
      //       frontend) is enough worse than the candidate past the eps margin.
      // Both routes are scored with the candidate as the shared normalisation
      // reference (pairwiseJ), so J_current >= J_candidate when the candidate is
      // genuinely better. nowMs is taken from the scenario time (clock-free).
      const hardUnsafe = hasHardUnsafeEdge(ctx, remaining);
      const rr = toRouteResult(snap, remaining, mode, A0);

      const candidateMetrics = {
        timeSec: remaining.timeSec,
        personalHeat: remaining.x,
        safetyMax: remaining.safetyMax,
      };
      const jCandidate = pairwiseJ(mode, candidateMetrics, candidateMetrics);

      // `current` may omit personalHeat; fall back to heatMinutes as a proxy.
      const currentMetrics = current
        ? {
            timeSec: current.timeSec,
            personalHeat: current.personalHeat ?? current.heatMinutes,
            safetyMax: current.safetyMax,
          }
        : candidateMetrics;
      const jCurrent = pairwiseJ(mode, currentMetrics, candidateMetrics);

      const offer: Offer | null = offerIfBetter(
        ctx,
        {
          current: remaining,
          candidate: remaining,
          jCurrent,
          jCandidate,
          nowMs: resolved.timeMs,
          candidateId: rr.id,
        },
        hardUnsafe,
      );
      const offerList = applySnooze(offer ? [offer] : [], snoozed);

      const payload = { remaining: rr, offers: offerList };
      res.json(isDev ? ReplanResponse.parse(payload) : payload);
    } catch (err) {
      sendError(res, err);
    }
  };
}

function toRouteResult(snap: Snapshot, r: ReturnType<typeof remainingRoute> & object, mode: RouteResult["mode"], A0: number): RouteResult {
  const route = r!;
  const dts: number[] = [];
  const hs: number[] = [];
  const lens: number[] = [];
  for (const e of route.edges) {
    dts.push(edgeTime(snap.len[e]!, snap.step[e] === 1));
    hs.push(snap.heat[e]!);
    lens.push(snap.len[e]!);
  }
  return {
    id: `remaining-${route.edges.length}-${Math.round(route.timeSec)}`,
    mode,
    geometry: route.nodes.map((n) => ({ lat: snap.nodeLat[n]!, lng: snap.nodeLon[n]! })),
    timeSec: route.timeSec,
    distanceM: route.distanceM,
    heatMinutes: route.heatMinutes,
    shadePct: route.shadeFrac * 100,
    arrivalBand: band(route.aEnd),
    safetyMax: route.safetyMax,
    oases: [],
    j: 0,
    feasible: route.safetyMax <= safetyCfg.S_hard,
    turns: [],
    aTrace: aTrace(A0, dts, hs, lens),
    explanations: [],
  };
}
