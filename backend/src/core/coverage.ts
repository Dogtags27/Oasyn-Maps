/**
 * core/coverage.ts — equity coverage of cooling resources (R12.1, R12.2).
 *
 * One multi-source Dijkstra from all oasis nodes yields walking MINUTES to the
 * nearest oasis for every node (R12.1). The share of nodes within 5 / 10 minutes
 * summarises access. Site suggestions use a deterministic greedy max-coverage
 * over the documented benefit proxy:
 *
 *   w_m = max(0, d_oasis[m] - d(m, candidate))
 *
 * i.e. how much a new oasis at `candidate` would reduce the nearest-oasis time
 * at node m (only where it helps). Labelled a heuristic (honesty principle).
 *
 * Pure/deterministic; ties by node id.
 */

import type { PlanContext } from "./types.js";
import { multiSource, dijkstraTree, type CostFn } from "./astar.js";
import { edgeTime } from "./cost.js";
import { coverage as covCfg } from "../config.js";

/** Walking-time arc cost in SECONDS (coverage is a time metric, not heat). */
export function timeCostFn(ctx: PlanContext): CostFn {
  const { snap, scenario } = ctx;
  return (e: number) => {
    const isStep = snap.step[e] === 1;
    if (scenario.stepFree && isStep) return Infinity;
    return edgeTime(snap.len[e]!, isStep);
  };
}

export interface CoverageResult {
  /** per-node seconds to the nearest oasis. */
  dMin: Float64Array;
  within5: number; // fraction [0,1]
  within10: number; // fraction [0,1]
  reachable: number; // count of reachable nodes
}

/** Multi-source nearest-oasis distances + within-5/10-minute shares. */
export function oasisCoverage(ctx: PlanContext, oasisNodes: number[]): CoverageResult {
  const tree = multiSource(ctx.graph, oasisNodes, timeCostFn(ctx));
  const dMin = tree.dist;
  const sec5 = covCfg.within5Min * 60;
  const sec10 = covCfg.within10Min * 60;
  let n5 = 0;
  let n10 = 0;
  let reachable = 0;
  for (let i = 0; i < dMin.length; i++) {
    const d = dMin[i]!;
    if (!Number.isFinite(d)) continue;
    reachable++;
    if (d <= sec5) n5++;
    if (d <= sec10) n10++;
  }
  return {
    dMin,
    within5: reachable > 0 ? n5 / reachable : 0,
    within10: reachable > 0 ? n10 / reachable : 0,
    reachable,
  };
}

export interface SiteSuggestion {
  node: number;
  /** total benefit (summed minutes saved) at the chosen site. */
  benefit: number;
}

/**
 * Greedy max-coverage: pick k candidate nodes that most reduce nearest-oasis
 * time. Deterministic — each round recomputes benefit against the current dMin
 * and picks the best (ties by lower node id). Candidates are sampled on a stride
 * to keep the O(k · candidates · tree) cost bounded on the full graph.
 */
export function suggestSites(
  ctx: PlanContext,
  oasisNodes: number[],
  k: number = covCfg.suggestK,
): SiteSuggestion[] {
  const { snap } = ctx;
  const base = oasisCoverage(ctx, oasisNodes).dMin;
  // Working copy of nearest-oasis seconds we improve as we place sites.
  const current = Float64Array.from(base);
  const suggestions: SiteSuggestion[] = [];

  // Candidate stride: cap the candidate set so suggestions stay fast on ~200k nodes.
  const maxCandidates = 2000;
  const stride = Math.max(1, Math.floor(snap.V / maxCandidates));

  const costFn = timeCostFn(ctx);

  for (let round = 0; round < k; round++) {
    let bestNode = -1;
    let bestBenefit = 0;
    // Evaluate each candidate: a forward tree from the candidate gives d(candidate, m).
    for (let c = 0; c < snap.V; c += stride) {
      if (!Number.isFinite(current[c]!)) continue; // unreachable area
      const tree = dijkstraTree(ctx.graph, c, costFn);
      let benefit = 0;
      const dc = tree.dist;
      for (let m = 0; m < snap.V; m++) {
        const improve = current[m]! - dc[m]!;
        if (improve > 0 && Number.isFinite(dc[m]!)) benefit += improve;
      }
      // ties by lower node id (strict >).
      if (benefit > bestBenefit) {
        bestBenefit = benefit;
        bestNode = c;
      }
    }
    if (bestNode < 0) break;
    suggestions.push({ node: bestNode, benefit: bestBenefit / 60 }); // minutes saved
    // Apply the chosen site to `current` so the next round is marginal benefit.
    const chosenTree = dijkstraTree(ctx.graph, bestNode, costFn);
    for (let m = 0; m < snap.V; m++) {
      if (chosenTree.dist[m]! < current[m]!) current[m] = chosenTree.dist[m]!;
    }
  }
  return suggestions;
}

/** Convert nearest-oasis seconds to minutes for a node. */
export function minutesAt(result: CoverageResult, node: number): number {
  const d = result.dMin[node]!;
  return Number.isFinite(d) ? d / 60 : Infinity;
}
