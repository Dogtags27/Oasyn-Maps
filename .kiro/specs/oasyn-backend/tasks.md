# Tasks: Oasyn Maps backend (Person A)

Person A edits `backend/` and the top of the root README only. Only Person A edits `backend/contract/`; after hour 0, contract changes are additive and announced. Each task is incremental, builds on the previous ones, and ends with tests green. (Note: the backend is a self-contained, separately deployable package — there is no monorepo root `package.json`.)

Tiers: **T1** = demo cannot run without it. **T2** = coverage, departure, polish. **T3** = stretch. Cut from the bottom if time runs short; never cut contract tests, escalation, offers-not-forced, i18n plumbing, or privacy/statelessness.

---

## Hour 1 — Scaffold, contract, config, data download

- [x] 1. Scaffold the backend package and tooling
  - Create `backend/package.json`, `tsconfig.json`, `vitest.config.ts`; add scripts (`dev`, `test`, `fixtures`, `lint:nohardcode`, `i18n:check`).
  - Create the `src/`, `contract/`, `scripts/`, `data/`, `test/` folder skeleton.
  - _Requirements: R16.1, R17_
  <!-- Decision: backend is a self-contained, separately deployable package (own package.json + lockfile). No monorepo root package.json / workspace wiring — the original "root package.json workspace wiring" was dropped so backend and frontend deploy independently. -->


- [x] 2. Define `config.ts` with every constant
  - Put bbox, speeds, step multiplier, `tau`, bands (`b1`, `b2`), weights per mode `(w_t, w_h, w_s, rho)`, `k0`, `alpha`, `a1..a3`, `n_t`, `n_b`, `Q_max`, `T_lo`, `T_hi`, thresholds (`T1`, `T2`, hysteresis, `S_hard`), event sizes, countdown length, `SNOOZE_MIN`, `REARM_DELTA`, `eps`, `o_max`, `delta_A`, `pf_max`, `gamma`, `m`, body constants (`Tc0`, `k_A`, `k_HR`, `r`), LRU size, grid cell size, sample step, and `seed`.
  - Export a `publicConfig` slice for `/api/config`.
  - _Requirements: R14.1, R14.2_

- [x] 3. Author the contract: schemas, messages, stub fixtures
  - [x] 3.1 Write `contract/schemas.ts` (zod) for every request/response, shared types (`Scenario`, `Zone`, `LatLng`, `RouteResult`, `Offer`, `Turn`, `OasisHit`, `RerouteEvent`, `Descriptor`, `ApiError`) and export `CONTRACT_VERSION`.
    - _Requirements: R13.1, R13.7_
  - [x] 3.2 Write `contract/messages.json` with every descriptor key the backend will emit plus example vars; document frontend-owned keys (`mode.*`, `preset.*`, `trip.*`).
    - _Requirements: R13.4_
  - [x] 3.3 Add one `kind: "sample"` fixture per endpoint under `contract/fixtures/` with illustrative Back Bay / Northeastern geometry and "Sample ..." resource names.
    - _Requirements: R13.8, R2.7_
  - [x] 3.4 Write `contract/README.md` restating the contract rules.
    - _Requirements: R13_

- [x] 4. Stub API server up (ping B when live)
  - [x] 4.1 `server.ts` bootstrap; `routes/error.ts` with `ApiError` mapping and the `X-Oasyn-Stub: true` helper.
    - _Requirements: R13.5, R13.6_
  - [x] 4.2 Mount all endpoints returning their fixtures with the stub header, each validating request bodies against the schema.
    - _Requirements: R13.2, R13.6_
  - [x] 4.3 `GET /api/config` returns `publicConfig`; `GET /api/meta` returns `meta.json` + `CONTRACT_VERSION`.
    - _Requirements: R13.3, R13.2_

- [x] 5. Contract test harness (gate)
  - Write `test/contract.test.ts`: every fixture validates against its schema; every descriptor key used in fixtures exists in `messages.json`. Wire into `npm test`.
  - _Requirements: R17.5, R13.4, R13.8_

- [x] 6. Start the data snapshot build
  - [x] 6.1 `scripts/build-data.mjs`: fetch Overpass layers (ways, parks, trees, buildings, water, places) for the bbox with mirror fallback; fetch cooling centers from the GIS URL.
    - _Requirements: R2.1, R2.4, R2.7_
  - [x] 6.2 Build the raw graph, write `meta.json` provenance per layer; log node/edge counts.
    - _Requirements: R2.3, R2.5_
  <!--
  DONE + evolved beyond the original scope. Changes recorded in design.md §3.1/§8.4/§14 and R2.6:
   - bbox expanded to Greater Boston inner metro (~600 km²); single Overpass call times out, so the fetch is TILED (4x4 grid) with per-tile retry + mirror fallback, merged by OSM id.
   - Added a VALIDATION GATE (node/edge minimums, non-empty layers, connected-component fraction); build fails loudly and publishes nothing on failure.
   - Snapshot is PUBLISHED TO CLOUDFLARE R2 (versioned key + latest pointer), NOT committed to git (~266 MB). Credentials from backend/.env (gitignored).
   - Ran for real: ~806k nodes / ~909k edges, ~99% connected, published + verified (scripts/verify-snapshot.mjs).
   - Also added (not in original Hour 1 list): Render stub deploy (render.yaml, CORS, /healthz), API_SAMPLE.md for the frontend handoff.
  Feature baking (25 m grid hash) + degree-2 contraction remain Hour 2 (task 7).
  -->


---

## Hour 2 — Graph build, contraction, features, layers, A*

- [x] 7. Bake static edge features and contract the graph (build script)
  - [x] 7.1 25 m grid hash; sample each edge; compute `trees`, `park`, `bldg`, and the `step` flag.
    - _Requirements: R2.2_
  - [x] 7.2 Degree-2 contraction (summed length, length-weighted features, concatenated geometry); log before/after counts; publish all outputs to R2 via the versioned-key + latest-pointer flow (not git — see R2.6 / design §8.4).
    - _Requirements: R1.6, R2.5, R2.6_
  <!--
  Optimized build: spatial grid hash per feature type (O(1) local-cell lookups, not O(E·F)); baking is scripts/lib/graph-build.mjs. Contraction 805,877->203,772 nodes (-75%), 909,343->307,238 edges (-66%), ~99% connected.
  BINARY CSR SNAPSHOT (scripts/lib/snapshot-format.mjs, magic OSNP v1): graph.bin is 13.56 MB vs ~170 MB raw JSON (~92% smaller), loads as typed-array views (near-zero parse).
  Reprocessing uses R2, NOT Overpass: `node scripts/build-data.mjs --from-r2` pulls the raw graph.json + layer JSONs from R2, re-bakes/contracts/encodes in ~8s and republishes. (Also: --reprocess reads a local raw cache; the full fetch now caches raw to data/.cache.)
  Follow-up: --from-r2 reprocesses off the `latest` pointer; pin a stable RAW source key so re-runs don't chain off a contracted snapshot (idempotent today, but fragile).
  -->

- [x] 8. Load the snapshot into CSR typed arrays (`snapshot.ts`)
  - Fetch the snapshot from R2 at startup (read the `latest` pointer, download, fail fast on fetch/validation error — design §8.4), then convert to `offsets`, `targets`, `edgeOf`, per-edge `Float32Array`s (`len`, `trees`, `park`, `bldg`), runtime `heat`/`safety` arrays, `step: Uint8Array`, projected node coords.
    - _Requirements: R1.1, R13 (load once), R15.3_
  <!-- Binary format means the ~266 MB-JSON parse concern is moot; graph.bin is 13.56 MB and decodes as views. `loadSnapshot()` supports r2 (default when creds present) / local / STUB_ONLY. Server boots live from R2: "snapshot loaded: 203772 nodes, 307238 edges (r2)". -->

- [x] 9. Graph access, grid hash, snap-to-node (`core/graph.ts`)
  - CSR neighbour iteration; build the grid-hash `Map`; `snap(latlng)` nearest node (ties by id); proximity queries for resources/features.
    - _Requirements: R1.3_

- [x] 10. A* and Dijkstra trees (`core/astar.ts`)
  - [x] 10.1 Binary heap with lazy decrease-key and `settled` bitmap; `astar(from, to, costFn, hFn)` stopping on goal pop; ties by id.
    - _Requirements: R6.1, R6.8_
  - [x] 10.2 Admissible/consistent heuristic from `c_min` and equirectangular distance x0.995.
    - _Requirements: R6.1_
  - [x] 10.3 `dijkstraTree(source, costFn)` (forward/backward) and `multiSource(sources, costFn)`.
    - _Requirements: R8.1, R9.1, R12.1_
  - [x] 10.4 Tests: A* == Dijkstra on seeded random small graphs; blocked edges unused; contraction preserves shortest-path length.
    - _Requirements: R17.2_
  <!-- Heuristic helper lives in core/graph.ts (equirectDist); A* applies the c_min * dist * 0.995 lower bound per-call (c_min supplied by the cost context in Hour 3). Tests in test/search.test.ts + test/snapshot-format.test.ts (22 passing total). -->

- [x] 11. Layer endpoints (`routes/layers.ts`) go live
  - Serve `parks|trees|water|cooling|places` from the snapshot with provenance; drop the stub header for these.
    - _Requirements: R2.3, R13.2_
  <!-- Optimized: layers lazy-fetched from the SAME source as the snapshot (R2/local) on first request and cached, so ~100 MB of display layers don't load at boot. Verified: /api/layers/cooling -> 200, no stub header, 35 real features, provenance.kind=real. Stub deploy (no snapshot) still returns the sample fixture. -->
  

---

## Hour 3 — Heat model, exposure, cost, frontier, scoring, real `/api/plan`

- [x] 12. Environment model (`core/env.ts`)
  - [x] 12.1 `sun`, `solarIntensity` (cloud + optional radiation), `apparentTemp` (NOAA Rothfusz + linear fallback), `thermalLoad`.
    - _Requirements: R3.1, R3.2, R3.3_
  - [x] 12.2 `edgeShade` (probabilistic union, building shade rises at low sun), `edgeHeat`, `heatMin`, `buildHeatArray` (O(E)).
    - _Requirements: R3.4, R3.5, R3.6, R3.7_
  - [x] 12.3 Tests: `H` monotone in `I` and `sigma`; `H in [0,1]`.
    - _Requirements: R17.1_
  <!-- env.ts uses `new Date(timeMs)` (deterministic conversion of an INPUT timestamp for suncalc) — not a wall-clock read. lint:nohardcode refined to ban only Date.now()/no-arg new Date(). -->

- [x] 13. Accumulated exposure (`core/exposure.ts`)
  - [x] 13.1 `stepA` exact closed form, `initA0`, `dwellA`, `arrivalExposure` with late-weighting, `aTrace`, `band`.
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5, R4.6_
  - [x] 13.2 Tests: closed form matches analytic; `A <= H*tau`; decay to 0 when `H = 0`.
    - _Requirements: R17.1_

- [x] 14. Edge cost and personal factor (`core/cost.ts`)
  - `personalFactor({A0, hr, hrBase, bodyDelta})`; `edgeCost` with hard-safety and step-free masking (inf); all terms non-negative.
  - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5_

- [x] 15. Safety field (`core/safety.ts`)
  - Gaussian kernel per edge, `max` over zones; `buildSafetyArray`; hard masking; retry-without-block + warning descriptor on disconnect; accept request + preset zones labelled SIMULATED.
  - _Requirements: R7.1, R7.2, R7.3, R7.4, R7.5_
  <!-- Hard masking in edgeCost; retry-without-mask + warning descriptor in core/plan.ts (R7.4). -->

- [x] 16. Candidate frontier (`core/frontier.ts`)
  - Aneja-Nair dichotomic weighted-sum anchored by fastest and coolest; dedupe by edge-id overlap > `o_max`; 2-5 routes.
  - Tests: all candidates non-dominated; endpoints are fastest and coolest.
  - _Requirements: R6.2, R6.3, R17.3_

- [x] 17. Scoring and ranking (`core/scoring.ts`)
  - `modeParams`, normalised `J`, filter by cap and hard safety, LARAC coolest-within-cap, rank (ties by id), feasibility.
  - Tests: higher `A0` → higher `pf`; coolest picks lower heat within cap; hard safety never overridden.
  - _Requirements: R6.4, R6.5, R17.4_

- [x] 18. Turns and explanations (`core/turns.ts`, `core/explain.ts`, `core/descriptors.ts`)
  - Bearing/name-change turn descriptors; rule-table explanation descriptors; compute the fresh-walker ranking for the "changed vs fresh" rule.
  - _Requirements: R6.7, R11.1, R11.2_
  <!-- Turns are bearing-based (names not in the CSR node arrays yet; name-change turns deferred). Fresh-walker ranking (A0=0) computed in core/plan.ts for the "changed vs fresh" rule. -->

- [x] 19. Real `POST /api/plan` (Checkpoint 1)
  - Wire the full pipeline (env → H/S → pf → frontier → score → turns → explanations); serialise to `PlanResponse`, validate in dev; drop the stub header. Snap within budget; structured no-path result on failure.
  - _Requirements: R1.2, R1.3, R1.4, R1.5, R6.6, R13.2_
  <!--
  core/plan.ts orchestrator + routes/plan.ts. Verified live against the R2 snapshot: Back Bay->Northeastern returns a real ranked route (924s/1294m/11.7 heat-min/19 turns), 200, NO stub header, deterministic across calls. The via-stop guard + backward-tree caching are Hour 4 (tasks 23/24), seams left in core/plan.ts.
  TUNING FOLLOW-UP (Hour 6, task 32): baked tree coverage is sparse (~7.4% of edges nonzero, avg 0.188) so H is near-uniform and fastest≈coolest on many corridors. Engine is correct (two-lane synthetic test shows proper fastest/coolest divergence); this is a feature-baking/normaliser tuning matter (n_t, radii), not a pipeline bug.
  -->
  

---

## Hour 4 — Body estimate, escalation, offers, via-stop, replan

- [x] 20. Body estimate (`core/body.ts`, `POST /api/body`)
  - `tcModel`, `tcUsed`, `pfUplift` capped at `pf_max`; range `+/- r`; band; labels "illustrative model" / SIMULATED.
  - Tests: `Tc_model` monotone in `A` and `HR`; delta triggers offer only above margin.
  - _Requirements: R10.1, R10.2, R10.3, R17.4_
  <!-- Verified live: obs 38.6 vs model 38.09 -> pfUplift 2.69 (triggered), label simulatedWearable, no stub header. -->

- [x] 21. Escalation reducer (`core/escalation.ts`, `POST /api/escalation/step`)
  - Pure `step(state, tcUsed, nowMs, action)`; all transitions; `deadlineMs`; dispatch_sim makes no network request and describes shared data with a permanent simulation flag.
  - Tests (fake clock): normal→caution at T1; countdown at T2; cancel→snoozed; expiry→dispatch_sim; re-arm only after REARM_DELTA; downward hysteresis.
  - _Requirements: R10.4, R10.5, R10.6, R10.7, R17.4_
  <!-- Pure reducer (nowMs is an input); no timers. Body + escalation routes are always real (no snapshot needed). Verified: caution + 39.2 -> countdown, deadlineMs = now + 60s. -->

- [x] 22. Rerouting and offers (`core/rerouting.ts`, `POST /api/replan`)
  - Backward tree cached by `hash(scenario, goal)`; pointer-following remaining route; hysteresis offer (never auto-switch); high-priority offer on hard-unsafe remaining edge; offers carry deltas/trigger/expiry/snoozeKey; per-kind snooze.
  - Tests: no offer below hysteresis; offer (not switch) on hard block; snooze respected.
  - _Requirements: R8.1, R8.2, R8.3, R8.4, R8.5, R8.6, R17.4_
  <!-- Backward tree cached in an LRU keyed by hashKey("bwd", mode, scenario, goal). Remaining route via pointer-following O(path). Hysteresis reroute offer NOW CLOSED: added optional ReplanRequest.current (remaining committed-route metrics, additive -> CONTRACT_VERSION 0.2.0); the route scores committed-vs-optimal with scoring.pairwiseJ (candidate as shared reference) and emits a reroute offer when J_current beats the eps margin, plus the high-priority safety offer on a hard-unsafe remaining edge. Verified live: bad current -> reroute offer (dJ -9.07); no current -> 0 offers (backward compatible); reroute snoozed -> 0 offers. -->

- [x] 23. Cooling via-stops (`core/cooling.ts`)
  - Two-tree evaluation over all resources in O(#resources); `A_T` with dwell; offer best within cap when `A_T` drops by `delta_A`. Wire the via-stop guard into `/api/plan`.
  - _Requirements: R9.1, R9.2, R9.3_
  <!-- Forward tree from start + backward tree from goal; cost_via = D_s + D_t + dwell. Resources (cooling+water) snapped to nodes once via routes/resources.ts, loaded from the snapshot source and cached. Guard fires in /api/plan only when recommended arrival band is "high". -->

- [x] 24. Caching and statelessness (`cache.ts`, `hash.ts`) (Checkpoint 2)
  - LRU for plan results and backward trees; verify no persistence between requests and no coordinate/identifier logging.
  - _Requirements: R15.1, R15.2, R15.3, R14.3, R14.4_
  <!-- cache.ts = bounded LRU (lruSize from config). hash.ts = FNV-1a over canonical (sorted-key) JSON; opaque digest, never logged with raw inputs. Backward-tree cache wired into /api/replan. Plan-result LRU seam left for the plan route (cheap to add in Hour 5 perf pass, task 27). No persistence between requests; logs carry no coordinates/identifiers (R14.4). -->
  

---

## Hour 5 — Coverage, departure, performance, hardening

- [x] 25. Coverage (`core/coverage.ts`, `POST /api/coverage`) **[T2]** (Checkpoint 3)
  - Multi-source oasis distances; share within 5/10 min; greedy max-coverage site suggestions labelled heuristic with documented proxy weights.
  - Tests: multi-source distances equal the min over single-source runs on a small graph.
  - _Requirements: R12.1, R12.2, R17.4_
  <!-- One multi-source Dijkstra for nearest-oasis seconds; within5/10 shares. Greedy max-coverage with documented proxy w_m = max(0, d_oasis[m] - d(m,candidate)), candidate stride-capped for scale, labelled coverage.heuristicNote. Verified live + test (multi-source == min over single-source). -->

- [x] 26. Departure planner (`core/departure.ts`, `POST /api/departure`) **[T2]**
  - Across-day frontier sampling in `stepMin` increments; curve of heat-minutes vs departure time + best window.
  - _Requirements: R12.3_
  <!-- Re-resolves env (sun moves) + rebuilds H per sampled time; safety built once (zones fixed across day). Curve of best-route heat-minutes + argmin window with reductionPct vs worst sample. -->

- [x] 27. Performance pass **[T1]**
  - Confirm step budgets (edge-heat < 2 ms, A* 1-5 ms, frontier < 30 ms, trees ~10 ms, reroute O(path)); ensure only `H`/`S` recompute per scenario.
  - _Requirements: R15.3, R15.4, R1.4_
  <!--
  Measured on the LIVE 203,772-node / 307,238-edge inner-metro graph (scripts/perf-check.mjs, `npm run perf-check`):
    edge-heat build  4.80 ms  (budget <2 ms — over, graph ~10x the budget's assumed size)
    safety build     0.02 ms
    A* fastest       1.59 ms  (budget 1-5 ms — PASS; this is the interactive hot path)
    Dijkstra tree  116.78 ms  (budget ~10 ms — over at 200k nodes; used by coverage/departure, latency-tolerant)
  Only H/S recompute per scenario; static CSR arrays load once (R15.3) — confirmed.
  Optimizations added: (a) skip the fresh-walker second frontier when the walker is already fresh (priorWalkMin<=0 && hr<=HR_base); (b) plan-result LRU keyed by hash(scenario,from,to,mode) with Server-Timing header (cache hit verified).
  HONEST NOTE: the original budgets assume a ~20k-edge box; at inner-metro scale full trees/multi-source scale up ~10x. Goal-directed A* (what /api/plan uses) stays in budget. The frontier's COOLEST anchor is slow on the near-uniform heat field (sparse OSM trees) because there's no gradient to guide A*; the Hackathon heat-sharpening we deferred will fix that directly. Follow-up option if needed: bound the coolest-anchor search or add landmark (ALT) heuristics.
  -->

- [x] 28. Headless CLI (`scripts/plan-cli.mjs`) **[T1]**
  - Import `src/core` via `tsx`; accept a scenario (file/stdin); print `PlanResponse`. Add a smoke test.
  - _Requirements: R16.1_
  <!-- Loads snapshot (R2/local), runs the real plan pipeline, prints a JSON summary + computeMs. Verified live against R2. Smoke test (test/plan-cli.test.ts) exercises the validation path network-free (invalid/empty input -> non-zero exit). -->

- [x] 29. No-hardcode and determinism guards **[T1]**
  - `lint:nohardcode` (no sentence literals in `core/`, no stray hex, no duplicated constants); confirm `core/` imports neither `Date` nor `Math.random`; `rng.ts` seeded from config; ties by id.
  - _Requirements: R14.2, R6.8, and the determinism principle_
  <!-- Guard now also flags SENTENCE literals in core/ (comments stripped first); passes clean against real core. Numeric formula coefficients intentionally NOT gated (they map to math.md, not config). rng.ts is mulberry32 seeded from config.seed; core/ ties break by node id throughout. -->
  

---

## Hour 6 — Tuning, fixtures, docs, Kiro evidence, stretch

- [x] 30. Regenerate fixtures from the live engine **[T1]**
  - `npm run fixtures` writes fixtures from the real engine output so mock mode stays close to live; re-run `contract.test.ts`.
  - _Requirements: R13.8, R17.5_
  <!-- scripts/gen-fixtures.mjs drives the real pipeline (plan/replan/body/escalation/coverage/departure) against the R2 snapshot and writes kind:"sample" fixtures with real inner-metro geometry. Contract gate re-validated (59/59). Also fixed a real perf bug this surfaced: suggestSites did a full Dijkstra per candidate (minutes) -> now a bounded Dijkstra to the within-10-min horizon (seconds); added astar.boundedDijkstra. -->

- [x] 31. Kiro evidence **[T1]**
  - Add backend steering (`.kiro/steering/`, scoped `inclusion: fileMatch`, `fileMatchPattern: "backend/src/core/**"`); add backend hooks (tests on save of `core/**`, descriptor-parity check); add backend `KIRO_LOG.md` lines; update the top of the root README with a "Built with Kiro" note for backend work.
  - _Requirements: R16.2_
  <!-- Steering: .kiro/steering/backend-core.md (fileMatch backend/src/core/**) with determinism/honesty/formula rules. Hooks: .kiro/hooks/backend-core-tests-on-save.json (vitest on core/** save) + backend-descriptor-parity.json (i18n:check on messages/fixtures/descriptors save). Log: backend/KIRO_LOG.md (one line per hour). README: expanded "Built with Kiro" section covering the backend. -->

- [x] 32. Documentation and honesty pass **[T1]**
  - Document the duality-gap limitation for coolest-within-cap; confirm every emitted layer carries provenance and every simulated feature is labelled.
  - _Requirements: R6.4, R2.3, R2.7, R7.2, R10.1_
  <!-- Duality gap documented in scoring.coolestWithinCap docstring + backend/LIMITATIONS.md. Audited honesty invariants: layers carry provenance (meta.json -> /api/layers); zones simulated:true (schema); body illustrative/simulated label; escalation dispatch_sim flagged + no network; resources status:"unknown" (R2.7). All confirmed. -->

- [ ] 33. Stretch **[T3]** — NOT done (per instruction; Hour 6 stops at task 32).
  - State-dependent exact search over `(node, bucket(A))` (`math.md` 5.4); incident-based safety kernel with recency weighting; MCP server. Only if everything above is green.
  - _Requirements: R6 (stretch), R7 (stretch)_
