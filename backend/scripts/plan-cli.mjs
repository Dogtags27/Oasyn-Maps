/**
 * plan-cli.mjs — headless scenario runner (R16.1).
 *
 * Loads the snapshot (R2 or local), runs the real plan pipeline for a scenario
 * read from a file or stdin, and prints the PlanResponse as JSON. Used by the
 * agent and the smoke test; no HTTP server needed.
 *
 * Run (via tsx so it can import the TS engine):
 *   tsx scripts/plan-cli.mjs <scenario.json>
 *   cat scenario.json | tsx scripts/plan-cli.mjs
 *
 * Scenario JSON shape = a PlanRequest:
 *   { "from": {lat,lng}, "to": {lat,lng}, "mode": "...", "scenario": {...} }
 */

import { readFileSync } from "node:fs";
import { loadSnapshot } from "../src/snapshot.js";
import { buildGraphView } from "../src/core/graph.js";
import { plan } from "../src/core/plan.js";
import { PlanRequest } from "../contract/schemas.js";

function readInput() {
  const fileArg = process.argv[2];
  if (fileArg) return readFileSync(fileArg, "utf8");
  // stdin
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function resolveScenario(s) {
  return {
    timeMs: Date.parse(s.timeISO),
    tempC: s.tempC, rh: s.rh, cloud: s.cloud, radiation: s.radiation,
    priorWalkMin: s.priorWalkMin ?? 0, hr: s.hr, stepFree: s.stepFree ?? false,
  };
}

async function main() {
  const raw = readInput();
  if (!raw.trim()) {
    console.error("plan-cli: no scenario provided (pass a file path or pipe JSON on stdin).");
    process.exitCode = 1;
    return;
  }
  const parsed = PlanRequest.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error("plan-cli: invalid PlanRequest:", JSON.stringify(parsed.error.issues, null, 2));
    process.exitCode = 1;
    return;
  }

  const snap = await loadSnapshot();
  const graph = buildGraphView(snap);
  const { from, to, mode, scenario } = parsed.data;

  const t0 = performance.now();
  const out = plan({ snap, graph, scenario: resolveScenario(scenario), zones: scenario.zones, mode, from, to });
  const ms = performance.now() - t0;

  const summary = out.noPath || !out.recommended
    ? { noPath: true }
    : {
        routes: out.routes.length,
        recommended: {
          timeSec: Math.round(out.recommended.timeSec),
          distanceM: Math.round(out.recommended.distanceM),
          heatMinutes: Number(out.recommended.heatMinutes.toFixed(2)),
          shadePct: Math.round(out.recommended.shadeFrac * 100),
          aEnd: Number(out.recommended.aEnd.toFixed(3)),
        },
        explanations: out.explanations.map((e) => e.key),
        safetyMaskDropped: out.safetyMaskDropped,
      };

  console.log(JSON.stringify({ computeMs: Number(ms.toFixed(2)), ...summary }, null, 2));
}

main().catch((err) => {
  console.error("plan-cli failed:", err.message);
  process.exitCode = 1;
});
