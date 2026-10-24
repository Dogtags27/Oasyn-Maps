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

- [ ] 12. Environment model (`core/env.ts`)
  - [ ] 12.1 `sun`, `solarIntensity` (cloud + optional radiation), `apparentTemp` (NOAA Rothfusz + linear fallback), `thermalLoad`.
    - _Requirements: R3.1, R3.2, R3.3_
  - [ ] 12.2 `edgeShade` (probabilistic union, building shade rises at low sun), `edgeHeat`, `heatMin`, `buildHeatArray` (O(E)).
    - _Requirements: R3.4, R3.5, R3.6, R3.7_
  - [ ] 12.3 Tests: `H` monotone in `I` and `sigma`; `H in [0,1]`.
    - _Requirements: R17.1_

- [ ] 13. Accumulated exposure (`core/exposure.ts`)
  - [ ] 13.1 `stepA` exact closed form, `initA0`, `dwellA`, `arrivalExposure` with late-weighting, `aTrace`, `band`.
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5, R4.6_
  - [ ] 13.2 Tests: closed form matches analytic; `A <= H*tau`; decay to 0 when `H = 0`.
    - _Requirements: R17.1_

- [ ] 14. Edge cost and personal factor (`core/cost.ts`)
  - `personalFactor({A0, hr, hrBase, bodyDelta})`; `edgeCost` with hard-safety and step-free masking (inf); all terms non-negative.
  - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5_

- [ ] 15. Safety field (`core/safety.ts`)
  - Gaussian kernel per edge, `max` over zones; `buildSafetyArray`; hard masking; retry-without-block + warning descriptor on disconnect; accept request + preset zones labelled SIMULATED.
  - _Requirements: R7.1, R7.2, R7.3, R7.4, R7.5_

- [ ] 16. Candidate frontier (`core/frontier.ts`)
  - Aneja-Nair dichotomic weighted-sum anchored by fastest and coolest; dedupe by edge-id overlap > `o_max`; 2-5 routes.
  - Tests: all candidates non-dominated; endpoints are fastest and coolest.
  - _Requirements: R6.2, R6.3, R17.3_

- [ ] 17. Scoring and ranking (`core/scoring.ts`)
  - `modeParams`, normalised `J`, filter by cap and hard safety, LARAC coolest-within-cap, rank (ties by id), feasibility.
  - Tests: higher `A0` → higher `pf`; coolest picks lower heat within cap; hard safety never overridden.
  - _Requirements: R6.4, R6.5, R17.4_

- [ ] 18. Turns and explanations (`core/turns.ts`, `core/explain.ts`, `core/descriptors.ts`)
  - Bearing/name-change turn descriptors; rule-table explanation descriptors; compute the fresh-walker ranking for the "changed vs fresh" rule.
  - _Requirements: R6.7, R11.1, R11.2_

- [ ] 19. Real `POST /api/plan` (Checkpoint 1)
  - Wire the full pipeline (env → H/S → pf → frontier → score → via-stop guard → turns → explanations → cache backward tree); serialise to `PlanResponse`, validate in dev; drop the stub header. Snap within budget; structured no-path result on failure.
  - _Requirements: R1.2, R1.3, R1.4, R1.5, R6.6, R13.2_

---

## Hour 4 — Body estimate, escalation, offers, via-stop, replan

- [ ] 20. Body estimate (`core/body.ts`, `POST /api/body`)
  - `tcModel`, `tcUsed`, `pfUplift` capped at `pf_max`; range `+/- r`; band; labels "illustrative model" / SIMULATED.
  - Tests: `Tc_model` monotone in `A` and `HR`; delta triggers offer only above margin.
  - _Requirements: R10.1, R10.2, R10.3, R17.4_

- [ ] 21. Escalation reducer (`core/escalation.ts`, `POST /api/escalation/step`)
  - Pure `step(state, tcUsed, nowMs, action)`; all transitions; `deadlineMs`; dispatch_sim makes no network request and describes shared data with a permanent simulation flag.
  - Tests (fake clock): normal→caution at T1; countdown at T2; cancel→snoozed; expiry→dispatch_sim; re-arm only after REARM_DELTA; downward hysteresis.
  - _Requirements: R10.4, R10.5, R10.6, R10.7, R17.4_

- [ ] 22. Rerouting and offers (`core/rerouting.ts`, `POST /api/replan`)
  - Backward tree cached by `hash(scenario, goal)`; pointer-following remaining route; hysteresis offer (never auto-switch); high-priority offer on hard-unsafe remaining edge; offers carry deltas/trigger/expiry/snoozeKey; per-kind snooze.
  - Tests: no offer below hysteresis; offer (not switch) on hard block; snooze respected.
  - _Requirements: R8.1, R8.2, R8.3, R8.4, R8.5, R8.6, R17.4_

- [ ] 23. Cooling via-stops (`core/cooling.ts`)
  - Two-tree evaluation over all resources in O(#resources); `A_T` with dwell; offer best within cap when `A_T` drops by `delta_A`. Wire the via-stop guard into `/api/plan`.
  - _Requirements: R9.1, R9.2, R9.3_

- [ ] 24. Caching and statelessness (`cache.ts`, `hash.ts`) (Checkpoint 2)
  - LRU for plan results and backward trees; verify no persistence between requests and no coordinate/identifier logging.
  - _Requirements: R15.1, R15.2, R15.3, R14.3, R14.4_

---

## Hour 5 — Coverage, departure, performance, hardening

- [ ] 25. Coverage (`core/coverage.ts`, `POST /api/coverage`) **[T2]** (Checkpoint 3)
  - Multi-source oasis distances; share within 5/10 min; greedy max-coverage site suggestions labelled heuristic with documented proxy weights.
  - Tests: multi-source distances equal the min over single-source runs on a small graph.
  - _Requirements: R12.1, R12.2, R17.4_

- [ ] 26. Departure planner (`core/departure.ts`, `POST /api/departure`) **[T2]**
  - Across-day frontier sampling in `stepMin` increments; curve of heat-minutes vs departure time + best window.
  - _Requirements: R12.3_

- [ ] 27. Performance pass **[T1]**
  - Confirm step budgets (edge-heat < 2 ms, A* 1-5 ms, frontier < 30 ms, trees ~10 ms, reroute O(path)); ensure only `H`/`S` recompute per scenario.
  - _Requirements: R15.3, R15.4, R1.4_

- [ ] 28. Headless CLI (`scripts/plan-cli.mjs`) **[T1]**
  - Import `src/core` via `tsx`; accept a scenario (file/stdin); print `PlanResponse`. Add a smoke test.
  - _Requirements: R16.1_

- [ ] 29. No-hardcode and determinism guards **[T1]**
  - `lint:nohardcode` (no sentence literals in `core/`, no stray hex, no duplicated constants); confirm `core/` imports neither `Date` nor `Math.random`; `rng.ts` seeded from config; ties by id.
  - _Requirements: R14.2, R6.8, and the determinism principle_

---

## Hour 6 — Tuning, fixtures, docs, Kiro evidence, stretch

- [ ] 30. Regenerate fixtures from the live engine **[T1]**
  - `npm run fixtures` writes fixtures from the real engine output so mock mode stays close to live; re-run `contract.test.ts`.
  - _Requirements: R13.8, R17.5_

- [ ] 31. Kiro evidence **[T1]**
  - Add backend steering (`.kiro/steering/`, scoped `inclusion: fileMatch`, `fileMatchPattern: "backend/src/core/**"`); add backend hooks (tests on save of `core/**`, descriptor-parity check); add backend `KIRO_LOG.md` lines; update the top of the root README with a "Built with Kiro" note for backend work.
  - _Requirements: R16.2_

- [ ] 32. Documentation and honesty pass **[T1]**
  - Document the duality-gap limitation for coolest-within-cap; confirm every emitted layer carries provenance and every simulated feature is labelled.
  - _Requirements: R6.4, R2.3, R2.7, R7.2, R10.1_

- [ ] 33. Stretch **[T3]**
  - State-dependent exact search over `(node, bucket(A))` (`math.md` 5.4); incident-based safety kernel with recency weighting; MCP server. Only if everything above is green.
  - _Requirements: R6 (stretch), R7 (stretch)_
