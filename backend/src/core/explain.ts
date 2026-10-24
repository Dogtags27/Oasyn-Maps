/**
 * core/explain.ts — rule-based route explanations (R11). No LLM.
 *
 * A fixed rule table turns computed metrics into descriptors:
 *   - shade difference between the recommended route and the fastest
 *   - the fastest route loses on heat (high heat-minutes)
 *   - the A0 (prior exposure) changed the ranking vs a fresh walker
 *   - coolest-within-cap pick
 *   - a safety block was present
 *
 * The "changed vs fresh" rule is COMPUTED, not assumed (R11.2): the caller
 * supplies both the actual ranking and a fresh-walker (A0 = 0) ranking so this
 * module can compare which route each would recommend.
 */

import type { Descriptor } from "../../contract/schemas.js";
import type { EngineRoute } from "./types.js";
import {
  explShadeDiff,
  explFastestLosesOnHeat,
  explA0ChangedRanking,
  explCoolestWithinCap,
  explSafetyBlock,
} from "./descriptors.js";

export interface ExplainInput {
  recommended: EngineRoute;
  fastest: EngineRoute;
  /** recommended route id under the actual (current-state) ranking. */
  recommendedKey: string;
  /** recommended route id under a fresh-walker (A0 = 0) ranking. */
  freshRecommendedKey: string;
  /** detour cap as a percentage over fastest time (for the coolest explanation). */
  capPct: number;
  /** true if any candidate hit a hard-safety block. */
  safetyBlocked: boolean;
}

export function explain(input: ExplainInput): Descriptor[] {
  const out: Descriptor[] = [];
  const { recommended, fastest } = input;

  // Shade difference vs the fastest route (only if meaningful).
  const shadeDiffPct = (recommended.shadeFrac - fastest.shadeFrac) * 100;
  if (shadeDiffPct >= 5) out.push(explShadeDiff(shadeDiffPct));

  // Fastest loses on heat: recommended isn't the fastest and saves heat-minutes.
  if (recommended !== fastest && fastest.heatMinutes - recommended.heatMinutes >= 1) {
    out.push(explFastestLosesOnHeat(fastest.heatMinutes));
  }

  // A0 changed the ranking vs a fresh walker.
  if (input.recommendedKey !== input.freshRecommendedKey) {
    out.push(explA0ChangedRanking());
  }

  // Coolest within cap (recommended is slower than fastest but within the cap).
  if (recommended !== fastest) {
    out.push(explCoolestWithinCap(input.capPct));
  }

  if (input.safetyBlocked) out.push(explSafetyBlock());

  return out;
}
