/**
 * api/mock.ts — resolve sample responses for mock mode (R2.2, R2.3, R2.8).
 *
 * Resolution order per endpoint:
 *   1. backend/contract/fixtures/<name>.json  (preferred when present)
 *   2. frontend/src/api/sample/<name>.json    (frontend-owned fallback seed)
 *
 * Every sample file is `{ kind: "sample", endpoint, response }`; we return the
 * `.response`. For escalation we additionally look a step up by
 * (state.phase, event) against the caution/critical thresholds from config, for
 * the sample walkthrough only — live is authoritative.
 */
import type {
  EscalationStateT,
  EscalationResponseT,
  SearchResponseT,
  SearchResultT,
} from "./types";

type SampleFile = { kind?: string; endpoint?: string; response: unknown };

// Vite eagerly bundles both trees. import.meta.glob keys are module paths.
const fixtureModules = import.meta.glob<SampleFile>("@contract/fixtures/*.json", {
  eager: true,
  import: "default",
});
const seedModules = import.meta.glob<SampleFile>("./sample/*.json", {
  eager: true,
  import: "default",
});

function basename(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.json$/, "");
}

function indexByName(
  modules: Record<string, SampleFile>,
): Record<string, SampleFile> {
  const out: Record<string, SampleFile> = {};
  for (const [path, mod] of Object.entries(modules)) {
    out[basename(path)] = mod;
  }
  return out;
}

const fixtures = indexByName(fixtureModules);
const seeds = indexByName(seedModules);

/** True when the resolved sample came from backend fixtures rather than the seed. */
export function sampleSource(name: string): "fixture" | "seed" | "none" {
  if (name in fixtures) return "fixture";
  if (name in seeds) return "seed";
  return "none";
}

/**
 * Resolve a sample response by logical name, preferring backend fixtures.
 * `name` is a bare file stem such as "plan", "config", or "layers.cooling".
 */
export function resolveSample<T = unknown>(name: string): T {
  const hit = fixtures[name] ?? seeds[name];
  if (!hit) {
    throw new Error(`No sample data for "${name}" (fixtures or seed).`);
  }
  return hit.response as T;
}

/** Resolve a per-layer sample, e.g. layer "cooling" -> "layers.cooling". */
export function resolveLayerSample<T = unknown>(layer: string): T {
  // A layer-specific sample always wins. The backend's single generic
  // layers.json fixture (an empty cooling layer) is only a last resort;
  // preferring it hid every per-layer seed and left the sample map and the
  // place search empty.
  if (`layers.${layer}` in fixtures) return fixtures[`layers.${layer}`].response as T;
  if (`layers.${layer}` in seeds) return seeds[`layers.${layer}`].response as T;
  if ("layers" in fixtures) return fixtures["layers"].response as T;
  if ("layers" in seeds) return seeds["layers"].response as T;
  throw new Error(`No sample layer data for "${layer}".`);
}

/**
 * Sample-mode place search: a case-insensitive match over the sample places,
 * parks, and cooling layers, shaped exactly like GET /api/search.
 */
export function mockSearch(q: string, limit: number): SearchResponseT {
  const needle = q.trim().toLowerCase();
  const out: SearchResultT[] = [];
  const layers: Array<[string, SearchResultT["kind"]]> = [
    ["places", "place"],
    ["parks", "park"],
    ["cooling", "cooling"],
  ];
  for (const [layer, kind] of layers) {
    let features: Array<Record<string, unknown>> = [];
    try {
      features = resolveLayerSample<{ features: Array<Record<string, unknown>> }>(layer).features;
    } catch {
      continue;
    }
    features.forEach((f, i) => {
      const props = (f.properties ?? {}) as { id?: string; name?: string };
      const geom = f.geometry as { type?: string; coordinates?: unknown } | undefined;
      if (!props.name || !props.name.toLowerCase().includes(needle)) return;
      let lng: number | undefined;
      let lat: number | undefined;
      if (geom?.type === "Point") [lng, lat] = geom.coordinates as number[];
      else if (geom?.type === "Polygon") [lng, lat] = (geom.coordinates as number[][][])[0]?.[0] ?? [];
      if (typeof lat !== "number" || typeof lng !== "number") return;
      out.push({
        id: `${layer}:${props.id ?? i}`,
        name: props.name,
        at: { lat, lng },
        kind,
        source: "local",
      });
    });
  }
  return { query: q, results: out.slice(0, limit), degraded: false };
}

/**
 * Mock the escalation reducer for the sample walkthrough (R2.8).
 *
 * The real reducer lives in the backend. Here we advance the phase by looking at
 * the current phase, the user action, and whether tcUsed is at/above the caution
 * (T1) or critical (T2) thresholds from config.
 */
export function mockEscalationStep(args: {
  state: EscalationStateT;
  tcUsed: number;
  nowMs: number;
  action: "cancel" | "none";
  T1: number;
  T2: number;
  countdownSec: number;
}): EscalationResponseT {
  const { state, tcUsed, nowMs, action, T1, T2, countdownSec } = args;
  const base = resolveSample<EscalationResponseT>("escalation");

  if (action === "cancel") {
    return { state: { phase: "normal" }, simulated: true };
  }

  // Countdown already running: expire into the simulated dispatch when due.
  if (state.phase === "countdown") {
    if (state.deadlineMs !== undefined && nowMs >= state.deadlineMs) {
      return {
        state: { phase: "dispatch_sim" },
        dispatchInfo: base.dispatchInfo,
        simulated: true,
      };
    }
    return { state, simulated: true };
  }

  if (tcUsed >= T2) {
    return {
      state: { phase: "countdown", deadlineMs: nowMs + countdownSec * 1000 },
      dispatchInfo: base.dispatchInfo,
      simulated: true,
    };
  }
  if (tcUsed >= T1) {
    return { state: { phase: "caution" }, simulated: true };
  }
  return { state: { phase: "normal" }, simulated: true };
}
