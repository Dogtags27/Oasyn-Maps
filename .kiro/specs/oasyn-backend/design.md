# Design: Oasyn Maps backend

This design realises the backend requirements. Formulas are stated in the plan's `math.md`; this file covers architecture, module boundaries, data structures, algorithm choices, and wiring. Symbols map to constants in `backend/src/config.ts`. The frontend contains no domain logic; everything it needs crosses the API as config values, descriptors, geometry, traces, offers, and escalation state.

## 1. High-level architecture

```text
                       ┌───────────────────────── backend process ─────────────────────────┐
HTTP (express/fastify) │                                                                    │
  /api/meta            │   routes/  ── validate (zod) ──► core/ (pure, deterministic)        │
  /api/config          │     │                               graph, env, exposure, cost,     │
  /api/presets         │     │                               search, frontier, rerouting,    │
  /api/layers/:name    │     │                               cooling, safety, coverage,      │
  /api/plan            │     ├── snapshot (loaded once at start, CSR typed arrays)            │
  /api/replan          │     ├── LRU cache (plan results, backward trees)                     │
  /api/body            │     └── contract/ (schemas, messages, fixtures)                      │
  /api/escalation/step │                                                                      │
  /api/coverage        │   scripts/ build-data.mjs, plan-cli.mjs                              │
  /api/departure       └──────────────────────────────────────────────────────────────────┘
```

Request lifecycle for `/api/plan`:

1. `routes/plan.ts` validates the body against `PlanRequest` (zod). Invalid -> 422 `ApiError`.
2. Compute `theta`, `I` from weather + sun (`core/env.ts`).
3. Build `H[e]`, `S[e]` arrays (O(E)).
4. Derive `pf` from `A0` and HR (`core/exposure.ts`, `core/body.ts`).
5. Frontier candidates (`core/frontier.ts`), dedupe.
6. Score, filter by mode cap and hard safety, rank by `J` (`core/scoring.ts`).
7. If best `aEnd` is high, via-stop evaluation (`core/cooling.ts`).
8. Turns for the selected route (`core/turns.ts`).
9. Explanations (`core/explain.ts`), including the fresh-walker ranking for the "changed vs fresh" rule.
10. Cache the backward tree from goal for `/api/replan`.
11. Serialise to `PlanResponse`, validate against the schema in dev, return.

The engine layer (`core/`) is pure: no I/O, no `Date.now()`, no `Math.random`. Routes are the only place that touches HTTP, caching, and the loaded snapshot.

## 2. Module layout

```text
backend/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    config.ts                 # every constant, band, weight, speed, limit, seed
    server.ts                 # http bootstrap, loads snapshot, mounts routes
    snapshot.ts               # load graph.json -> CSR typed arrays; grid hash build
    cache.ts                  # tiny LRU keyed by stable hashes
    rng.ts                    # mulberry32 seeded PRNG (seed from config)
    hash.ts                   # stable hash of scenario/start/goal/mode
    routes/
      meta.ts config.ts presets.ts layers.ts
      plan.ts replan.ts body.ts escalation.ts coverage.ts departure.ts
      error.ts                # ApiError mapping, X-Oasyn-Stub header helper
    core/                     # PURE, deterministic, descriptors only (no sentences)
      types.ts
      graph.ts                # CSR access, grid hash queries, snap-to-node
      env.ts                  # sun, I, theta, sigma, H, H_min
      exposure.ts             # leaky integrator, A0, aTrace, bands
      cost.ts                 # edge cost, pf inputs, step-free / hard-safety masking
      astar.ts                # A* + Dijkstra; backward/forward trees; multi-source
      frontier.ts             # Aneja-Nair dichotomic weighted-sum; dedupe
      scoring.ts              # J, mode caps, ranking, feasibility
      rerouting.ts            # pointer-following, hysteresis offers
      cooling.ts              # two-tree via-stop evaluation
      safety.ts               # Gaussian safety field, hard masking
      coverage.ts             # multi-source oasis distances, greedy max-coverage
      departure.ts            # across-day frontier sampling
      body.ts                 # Tc_model, pf uplift, delta
      escalation.ts           # pure reducer (state, Tc_used, now, action)
      turns.ts                # bearing/name-change instructions (descriptors)
      explain.ts              # rule table -> descriptors
      descriptors.ts          # typed helpers that build {key, vars}
  contract/
    README.md
    schemas.ts                # zod, source of truth
    messages.json             # every descriptor key + example vars
    fixtures/*.json           # validated sample responses (kind: "sample")
  scripts/
    build-data.mjs            # Overpass + GIS snapshot build, feature baking, contraction
    plan-cli.mjs              # headless scenario runner (tsx)
  data/                       # local snapshot outputs + meta.json (gitignored; published to R2, not committed)
  test/                       # vitest specs mirroring core/ + contract validation
```

## 3. Snapshot and graph (R1, R2)

### 3.1 Build (`scripts/build-data.mjs`)

Node ESM script, run manually, publishes outputs to Cloudflare R2 (not git). The bbox is the Greater Boston **inner metro** (~600 km², ~24.5 km × 24.5 km centered on 42.341, -71.084), covering Boston, Cambridge, Somerville, Brookline, Chelsea, Everett, and the inner ring. A single Overpass call for 600 km² times out, so the fetch is **tiled**. Steps:

1. Split `config.bbox` into a `tiles × tiles` grid; fetch each tile from Overpass separately (primary then mirror on failure, with retry + backoff per tile), and merge results deduping OSM elements by `type/id` across tile seams.
2. Fetch cooling centers from the Boston GIS FeatureServer query URL in config.
3. Build the raw undirected graph from ways; dedupe nodes by rounded coordinate.
4. Bake per-edge features with a 25 m grid hash, sampling each edge every `sampleStepM`: `trees` (count within 20 m), `park` (fraction of samples in/near a park), `bldg` (building centroids within 30 m). Also a `step` flag from `highway=steps` and `wheelchair=no`. (Hour 2.)
5. Degree-2 contraction: collapse chains through degree-2 nodes into one edge with summed length, length-weighted-averaged features, concatenated geometry. Log counts before/after. (Hour 2.)
6. **Validation gate**: node/edge minimums, non-empty layers, and largest-connected-component fraction must pass, else the build fails loudly and publishes nothing (guards against Overpass silent-partial-success).
7. Write `graph.json`, `parks.json`, `trees.json`, `water.json`, `cooling.json`, `places.json`, `buildings.json`, and `meta.json` (provenance per layer) locally, then upload to R2 under a versioned key `snapshots/<area>/<version>/` and advance the `latest.json` pointer only after every object is uploaded.

Observed inner-metro raw build: ~806k nodes / ~909k edges, ~99% connected; `graph.json` ~170 MB and `buildings.json` ~96 MB — the reason the snapshot is published to R2 rather than committed.

`GraphFile` shape (from the plan):

```ts
type GraphFile = {
  nodes: [number, number][];                 // lat, lon
  edges: { u: number; v: number; len: number; name?: string; kind: string;
           step?: boolean;
           trees: number; park: number; bldg: number; geom: [number, number][] }[];
};
```

### 3.2 Load (`snapshot.ts`)

At server start, read `graph.json` once and convert to CSR typed arrays:

- `offsets: Int32Array(|V|+1)`, `targets: Int32Array(2|E|)`, `edgeOf: Int32Array(2|E|)`.
- Per-edge `Float32Array`: `len`, `trees`, `park`, `bldg`. Runtime arrays `heat`, `safety` are allocated once and overwritten per scenario.
- `step: Uint8Array` per edge.
- Node coordinates in a local equirectangular projection (`x = R*dlon*cos(lat0)`, `y = R*dlat`) for distances and the grid hash.

### 3.3 Grid hash and snap (`graph.ts`)

Cell size `g = 25 m`. `cell(x,y) = (floor(x/g), floor(y/g))`. A `Map<cellKey, nodeId[]>` built once. Snap: project the query point, scan its cell and the 8 neighbours, return the nearest node (ties by node id). Same structure answers tree/park/building/resource proximity queries.

## 4. Environment and exposure (R3, R4, R5)

`core/env.ts`:

- `sun(date, lat0, lon0) -> { s, azimuth }` via `suncalc`.
- `solarIntensity(cloud, radiation?) -> I in [0,1]`.
- `thermalLoad(T_app) -> theta`; `apparentTemp(live?, T, RH) -> T_app` (NOAA Rothfusz + linear fallback).
- `edgeShade(trees, park, bldg, s) -> sigma`; `edgeHeat(theta, I, sigma) -> H`; `heatMin(theta, I) -> H_min`.
- `buildHeatArray(scenario) -> Float32Array` fills `heat[e]` in O(E).

Properties enforced by tests: `H in [0,1]`, `dH/dI >= 0`, `dH/dsigma <= 0`.

`core/exposure.ts`:

- `stepA(A, H, dt, tau) -> A'` exact closed form.
- `initA0(H_p, P, tau) -> A0`.
- `dwellA(A, H_r, d, tau) -> A'`.
- `arrivalExposure(A0, edges, H, dt, T, tau) -> A_T` with late-weighting.
- `aTrace(...) -> number[]` triples (time, distance, A) for playback.
- `band(A) -> 'low'|'elevated'|'high'` from config thresholds.

`core/cost.ts`:

- `personalFactor({ A0, hr, hrBase, bodyDelta }) -> pf`.
- `edgeCost(e, { heat, safety, len, pf, weights, stepFree }) -> number` (inf on hard safety or on a step edge when step-free is on).

## 5. Search, frontier, scoring (R6, R7)

`core/astar.ts`:

- `astar(from, to, costFn, heuristicFn) -> { edges, time, heat, safetyMax, dist }`. Binary heap, lazy decrease-key, `settled: Uint8Array`, stop when goal is popped. Ties by node id.
- `heuristic(n, goal) = c_min * equirectDist(n, goal) * 0.995` (admissible, consistent).
- `dijkstraTree(source, costFn) -> { dist: Float32Array, nextHop: Int32Array }` for forward/backward trees.
- `multiSource(sources, costFn) -> Float32Array` for coverage.

`core/frontier.ts`:

- `frontier(from, to, ctx) -> Route[]`: Aneja-Nair recursion. Anchors `R_fast` (min time) and `R_cool` (min personal heat). For a pair, `lambda = (T_b - T_a)/(X_a - X_b)`, solve `argmin T + lambda*X`; keep and recurse if strictly below the segment. Dedupe by edge-id bitset overlap above `o_max`. Yields 2-5 supported routes.

`core/safety.ts`:

- `safetyField(zones, edgeMid) -> S_e` Gaussian kernel, `max` over zones.
- `buildSafetyArray(zones) -> Float32Array`; `hardMask` applied in `edgeCost`.
- If hard masking disconnects start and goal, the plan route retries without the mask and sets a warning descriptor.

`core/scoring.ts`:

- `modeParams(mode) -> { w_t, w_h, w_s, rho }` from config.
- `score(route, refs, modeParams) -> J` normalised by the fastest route.
- `rank(routes, mode) -> RouteResult[]`: filter by cap `T <= rho*T_fast` and hard safety, sort by `J`, break ties by id. LARAC pick for coolest-within-cap.

## 6. Rerouting, cooling, body, escalation (R8, R9, R10)

`core/rerouting.ts`:

- `backwardTree(goal, ctx)` cached by `hash(scenario, goal)`.
- `remainingRoute(nextNode, tree)` pointer-following, O(path).
- `offerIfBetter(current, candidate, cfg) -> Offer | null`: hysteresis `J_new < (1-eps)*J_current`, or high priority on a hard-unsafe remaining edge. Offer carries `deltaTime`, `deltaHeat`, `deltaJ`, `trigger`, `expiry`, `snoozeKey`.

`core/cooling.ts`:

- `viaStops(start, goal, resources, ctx) -> Offer | null`: forward tree `D_s`, backward tree `D_t`; for each resource `cost_via = D_s[n_r] + D_t[n_r] + dwell_cost(r)`; compute `A_T` with a dwell; offer the best within `rho*T_fast` when `A_T` drops by at least `delta_A`.

`core/body.ts`:

- `tcModel(A, hr, hrBase) -> number`; `tcUsed({ model, obs, wearableOn })`; `pfUplift(delta, cfg) -> factor` capped at `pf_max`.

`core/escalation.ts` — pure reducer:

```ts
type Phase = 'normal' | 'caution' | 'countdown' | 'snoozed' | 'dispatch_sim';
type EscalationState = { phase: Phase; deadlineMs?: number; tcAtSnooze?: number; snoozeUntilMs?: number };
function step(state: EscalationState, tcUsed: number, nowMs: number, action?: 'cancel' | 'none'): EscalationState;
```

Transitions per `math.md` section 11: normal → caution at `T1`; caution → countdown at `T2` (sets `deadlineMs = nowMs + countdownMs`); countdown → dispatch_sim on expiry; countdown → snoozed on cancel (`snoozeUntilMs = nowMs + SNOOZE_MIN`, record `tcAtSnooze`); snoozed → countdown when `tcUsed >= tcAtSnooze + REARM_DELTA` or timer; caution/countdown → normal when `tcUsed < T1 - hysteresis`. No timers inside; `nowMs` is an input. The route returns `deadlineMs` so the frontend counts down locally. Dispatch makes no network request; it returns a descriptor of the data that would be shared with a permanent simulation flag.

## 7. Coverage and departure (R12)

`core/coverage.ts`:

- `oasisCoverage(resourceNodes, ctx) -> { dMin: Float32Array, within5: number, within10: number }` via one multi-source Dijkstra.
- `suggestSites(k, ctx) -> nodeId[]`: greedy max-coverage with the documented benefit proxy `w_m = max(0, d_oasis[m] - d(m, n))`, grid-hash local search, deterministic.

`core/departure.ts`:

- `departureCurve(start, goal, ctx) -> { points: {tISO, heatMin}[]; best: {tISO, reductionPct} }` sampling the best route in `stepMin` increments across the day (one frontier per step).

## 8. API layer and contract (R13, R14, R15)

### 8.1 Contract (`contract/`) — the only shared surface

- `schemas.ts`: zod for `Meta`, `Config`, `Presets`, `LayerResponse`, `PlanRequest`/`PlanResponse`, `ReplanRequest`/`ReplanResponse`, `BodyRequest`/`BodyResponse`, `EscalationRequest`/`EscalationResponse`, `CoverageRequest`/`CoverageResponse`, `DepartureRequest`/`DepartureResponse`, `ApiError`, `Descriptor`, `Scenario`, `Zone`, `LatLng`, `RouteResult`, `Offer`, `RerouteEvent`, `OasisHit`, `Turn`. `CONTRACT_VERSION` exported here.
  - **Versioning:** breaking change bumps the major, additive change bumps the minor (R13.7). `0.2.0` added optional `ReplanRequest.current` (remaining committed-route metrics) so `/api/replan` can emit the hysteresis reroute offer (R8.3) by comparing the committed route against the optimal remaining via `scoring.pairwiseJ`. Omitting `current` preserves the prior safety-offer-only behaviour.
- `messages.json`: every descriptor key the backend can emit with example vars. Frontend-owned label keys (`mode.*`, `preset.*`, `trip.*`) are documented as owned by the frontend.
- `fixtures/*.json`: one validated sample response per endpoint, `kind: "sample"`, illustrative Back Bay / Northeastern geometry, cooling/water named "Sample ...".

Rules enforced by tests: fixtures validate against schemas; every emitted key exists in `messages.json`.

### 8.2 Routes

Each route: validate request → call core → serialise → validate response (dev) → send. `error.ts` maps zod failures to `ApiError` (400/422) and provides the `X-Oasyn-Stub: true` helper for endpoints still returning fixtures.

- `GET /api/meta` → `{ name, url, retrievedAt, kind, notes, contractVersion }` from `meta.json` + `CONTRACT_VERSION`.
- `GET /api/config` → the public slice of `config.ts` (bands, ramp steps, limits, speeds, event sizes, countdown, caps). The frontend reads all thresholds from here.
- `GET /api/presets` → weather scenarios, trips, seeded SIMULATED zones.
- `GET /api/layers/:name` → `parks|trees|water|cooling|places` from the snapshot with provenance.
- `POST /api/plan` → pipeline of section 1.
- `POST /api/replan` → backward-tree pointer-follow + offer; cached tree.
- `POST /api/body` → `Tc_model`, range, band, pf uplift.
- `POST /api/escalation/step` → one reducer step, returns next state + `deadlineMs`.
- `POST /api/coverage` → coverage layer + summary + suggested sites.
- `POST /api/departure` → departure curve + best window.

### 8.3 Config, caching, statelessness

- `config.ts` holds every constant. `/api/config` exposes the public subset. No constant is duplicated in routes or core beyond `config.ts`.
- `cache.ts`: LRU for plan results (`hash(scenario, start, goal, mode)`) and backward trees (`hash(scenario, goal)`). Bounded size from config.
- Stateless: no persistence between requests; logging never includes coordinates or identifiers.
- Outbound weather is owned by the backend (decided, R3.8): when a scenario requests live weather, the server calls Open-Meteo with coordinates rounded to 2 decimals and no UUID, and falls back to the Heatwave preset with a notice descriptor on failure. The frontend never calls Open-Meteo directly.

### 8.4 Snapshot storage and startup load (decided)

- The snapshot is published to **Cloudflare R2** (S3-compatible) by the build script, not committed to git (R2.6). Keyed `snapshots/<area>/<version>/` with a `latest.json` pointer advanced only after a passing validation gate.
- R2 credentials come from the environment (`.env`, gitignored; `.env.example` committed). They are never hardcoded and never committed. The real backend reads them at startup to fetch the snapshot; the stub server (below) needs none.
- **Startup load (`snapshot.ts`, Hour 2):** read the `latest` pointer, download the snapshot from R2, load into CSR typed arrays, fail fast if the fetch or load fails. At inner-metro scale (~266 MB JSON) a binary snapshot format is the planned optimisation so startup parse stays fast.
- **Stub test deploy (Render):** `server.ts` runs standalone returning validated fixtures with `X-Oasyn-Stub: true`. It touches no storage, needs no R2 credentials, adds permissive CORS and a `/healthz` check, and exists to give the frontend live sample data during Hour 1. See `backend/API_SAMPLE.md` and `backend/render.yaml`.
- **Deployment:** backend and frontend are independent, separately deployable packages. The backend is self-contained (`backend/` has its own `package.json` + lockfile); there is no monorepo root `package.json` / workspace.

## 9. Determinism and seeded randomness (cross-cutting)

- `rng.ts` is mulberry32 seeded from `config.seed`; used for seeded hotspot generation and tree-glyph jitter in the build script, never in request handling.
- `core/` imports neither `Date` nor `Math.random`; time arrives as `timeISO`/`nowMs`.
- All sorts and heaps break ties by node id so identical inputs yield identical routes.

## 10. Headless CLI and Kiro evidence (R16)

- `scripts/plan-cli.mjs` imports `src/core` via `tsx`, accepts a scenario JSON (file or stdin), prints the `PlanResponse`. Used by the agent and smoke tests.
- Steering: `.kiro/steering/` file scoped with `inclusion: fileMatch`, `fileMatchPattern: "backend/src/core/**"`, carrying `math.md` guidance. Backend hooks (e.g. run `npm --prefix backend test` on save of `backend/src/core/**`, and an `i18n:check`-style descriptor-parity check). `KIRO_LOG.md` gets one backend line per hour.

## 11. Testing strategy (R17)

Vitest, mirroring `core/`. Deterministic throughout; escalation uses a fake clock via the injected `nowMs`.

- `exposure.test.ts`: monotonicity of `H`; closed-form `stepA` matches analytic; `A <= H*tau`; decay to 0.
- `search.test.ts`: A* == Dijkstra on seeded random small graphs; blocked edges unused; contraction preserves shortest-path length.
- `frontier.test.ts`: all candidates non-dominated; endpoints are fastest and coolest.
- `scoring.test.ts`: higher `A0` → higher `pf`; coolest picks lower heat within cap; hard safety never overridden.
- `rerouting.test.ts`: no offer below hysteresis; offer (not switch) on hard block; snooze respected.
- `escalation.test.ts`: normal→caution at T1; countdown at T2; cancel → snoozed; expiry → dispatch_sim; re-arm only after REARM_DELTA; downward hysteresis.
- `body.test.ts`: `Tc_model` monotone in `A` and `HR`; delta triggers offer only above margin.
- `coverage.test.ts`: multi-source distances equal the min over single-source runs on a small graph.
- `contract.test.ts`: every fixture validates against its schema; every emitted descriptor key exists in `messages.json`.

## 12. Technology choices

- TypeScript, Node ESM. HTTP via **express** (chosen at scaffold time); routes stay framework-light so core is unaffected.
- `zod` for schemas, `suncalc` for sun position, `vitest` for tests, `tsx` for the entrypoint and headless CLI. `@aws-sdk/client-s3` + `dotenv` for the R2 snapshot pipeline; `cors` for the test deploy.
- Typed arrays + CSR + contraction for the hot loop (no objects per node/edge).

## 13. Error handling and resilience

- Invalid request body → `ApiError` 400/422 (zod issues mapped to a stable shape, messages as descriptors).
- No path → structured no-path result with a warning descriptor; previous state preserved client-side.
- Snapshot load failure at start → fail fast with a clear log; the process does not serve partial data.
- Live weather failure (if the backend fetches it) → fall back to the Heatwave preset and set a descriptor so the frontend can disclose it.
- Stub endpoints set `X-Oasyn-Stub: true` until the real engine backs them.

## 14. Open decisions

Open:

1. Exact `B` (bucket count) for the stretch state-dependent search (`math.md` 5.4) — out of MVP scope, left as a stretch module.
2. Snapshot on-disk format: JSON today; move to a compact **binary** CSR dump before the inner-metro snapshot loads at startup, so parse stays fast (~266 MB JSON is slow to parse on boot).

Resolved:

- **HTTP framework: express** (section 12). Routes stay framework-light so core is unaffected.
- **Live weather is fetched by the backend** (R3.8, R14.3), with coordinates rounded to 2 decimals and no UUID.
- **Area / bbox: Greater Boston inner metro, ~600 km²** (section 3.1), not the Back Bay / Northeastern starter box.
- **Snapshot storage: Cloudflare R2** (S3-compatible), published by the build script under a versioned key with a `latest` pointer, fetched at startup — not committed to git (R2.6, section 8.4). Chosen over S3 for free egress; the AWS-hosted backend reads it over the internet once per boot (off the request hot path). Credentials from env only.
- **Build resilience: tiled Overpass fetch + retry + a hard validation gate** (section 3.1) so a flaky or partial Overpass response never produces a published snapshot.
- **Deployment: backend and frontend are independent packages** with no monorepo root `package.json`. A stub of the backend (fixtures only, no storage/credentials) deploys to Render for frontend sample-data sharing (section 8.4).
