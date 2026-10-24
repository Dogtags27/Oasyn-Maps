# Requirements: Oasyn Maps backend

## Introduction

Oasyn Maps is heat-aware walking navigation. This document specifies the **backend** scope only: the deterministic routing engine, the environment and exposure models, the data snapshot pipeline, the safety logic, the coverage and departure planners, the escalation reducer, and the HTTP API that exposes all of this to the frontend.

The frontend is a separate spec (`.kiro/specs/oasyn-frontend`). The two sides meet only at `backend/contract/` (zod schemas, a message-key catalog, and validated sample fixtures). This boundary is a hard rule: the frontend contains no domain logic and no thresholds; everything it displays or thresholds on comes from the API.

### Scope boundary (what the backend owns)

- The routing engine and all math in `backend/src/core` (graph, environment model, exposure, cost, search, rerouting, cooling stops, safety field, coverage, departure, body estimate, escalation reducer).
- The data snapshot build script and the committed snapshot it produces.
- The HTTP API and its contract (`backend/contract/`).
- The headless `plan` CLI and backend tests.
- Backend-side Kiro evidence (steering for `backend/src/core/**`, this spec, backend hooks, `KIRO_LOG.md` entries for backend work).

### Non-goals (frontend spec owns these)

- Map rendering, route colouring, legends, Sun mode, mobile layout, watch UI, landing page.
- i18n rendering (`t(key, vars)`), locale files, number/unit formatting in the UI.
- Playback animation, Lab controls, charts, offer cards, countdown UI.
- Privacy UI and on-device UUID handling.

The backend supplies the data that makes those features possible (config values, message descriptors, bands, geometry, exposure traces, offers, escalation state) but renders none of it.

### Determinism principle (applies to every requirement below)

Identical inputs SHALL produce identical outputs. No `Math.random`, no `Date.now()`, no wall-clock reads inside `backend/src/core`; time and randomness are inputs. Randomness uses a seeded PRNG (mulberry32) with the seed in config. Ties are broken by node id.

### Honesty principle

Heat exposure is **estimated** from available data, not measured. Personal exposure scores and the estimated core temperature are **modeled indicators**, not medical assessments. Every data layer carries provenance. Simulated features (safety zones, wearable, dispatch) are labelled as simulated in the data the backend emits.

---

## Requirements

### R1 Walking graph and routing substrate

**User story:** As the frontend, I want a loaded, contracted walking graph and fast snap-and-route, so that a user picking start and destination gets ranked routes quickly.

#### R1 acceptance criteria

1. THE SYSTEM SHALL load a committed, degree-2-contracted OSM walking-graph snapshot into CSR typed-array form (`offsets`, `targets`, `edgeOf`, and per-edge `len`, `trees`, `park`, `bldg`, `heat`, `safety`) at server start.
2. THE SYSTEM SHALL route on the contracted graph in the backend engine and expose results only through the documented API contract.
3. WHEN a request supplies start and goal coordinates THE SYSTEM SHALL snap each to the nearest graph node using the spatial grid hash.
4. THE SYSTEM SHALL return ranked routes within 50 ms of compute time for the committed snapshot on a typical dev machine.
5. IF no path exists between the snapped start and goal THE SYSTEM SHALL return a structured, frontend-renderable "no path" result (descriptor, not a sentence) and SHALL NOT throw.
6. THE SYSTEM SHALL preserve shortest-path lengths through degree-2 contraction (contraction is lossless for routing).

### R2 Data snapshot pipeline

**User story:** As the backend owner, I want a reproducible data build, so that static edge features are computed once and committed, and only runtime fields vary per request.

#### R2 acceptance criteria

1. THE SYSTEM SHALL provide a build script (`backend/scripts/build-data.mjs`) that produces `graph.json`, `parks.json`, `trees.json`, `water.json`, `cooling.json`, `places.json`, and `meta.json` for the configured bounding box.
2. THE SYSTEM SHALL compute per-edge static features (`trees`, `park`, `bldg`) at build time via the 25 m grid hash, sampling each edge at a configured spacing.
3. THE SYSTEM SHALL record provenance in `meta.json` for every layer (name, url, retrievedAt, kind, notes).
4. WHEN the primary Overpass endpoint fails THE SYSTEM SHALL fall back to the configured mirror.
5. THE SYSTEM SHALL log node and edge counts before and after contraction.
6. THE SYSTEM SHALL commit the generated snapshot outputs so the engine runs without a live download.
7. THE SYSTEM SHALL label cooling-center and fountain sample records so they are not mistaken for authoritative real-time facility data (status defaults to "unknown" unless the source says otherwise).

### R3 Environment model (shade and heat rate)

**User story:** As the engine, I want per-edge shade and heat-rate values, so that routes can be scored by modeled heat exposure.

#### R3 acceptance criteria

1. THE SYSTEM SHALL compute sun altitude and azimuth from the scenario time and the map center via `suncalc`, and derive `s = max(0, sin beta)`.
2. THE SYSTEM SHALL compute solar intensity `I` in `[0,1]` from cloud fraction (simplified Kasten-Czeplak), or from live shortwave radiation clamped by `Q_max` when available.
3. THE SYSTEM SHALL compute apparent temperature from live data when present, otherwise from the NOAA heat index (Rothfusz) with the low-HI linear fallback, and derive thermal load `theta = clamp((T_app - T_lo)/(T_hi - T_lo))`.
4. THE SYSTEM SHALL compute per-edge shade `sigma` as the probabilistic union of canopy shade `sigma_c` and building shade `sigma_b`, where building shade increases at low sun.
5. THE SYSTEM SHALL compute per-edge heat rate `H = theta * (k0 + (1-k0) * I * (1 - alpha*sigma))` and guarantee `H in [0,1]`, `dH/dI >= 0`, `dH/dsigma <= 0`.
6. THE SYSTEM SHALL compute `H_min` (using `sigma_max`) for use as an admissible A* lower bound.
7. WHEN weather or time inputs change THE SYSTEM SHALL recompute `H[e]` and `S[e]` arrays in O(E) without reloading static features.
8. WHERE the scenario requests live weather THE SYSTEM SHALL own the outbound Open-Meteo request, round coordinates to 2 decimals before sending, send no UUID or identifier, and fall back to the Heatwave preset with a notice descriptor on failure. (The frontend never calls Open-Meteo directly.)

### R4 Accumulated exposure (personal state)

**User story:** As the engine, I want to model accumulated exposure as a leaky integrator, so that recommendations adapt to a user's modeled prior and in-walk exposure.

#### R4 acceptance criteria

1. THE SYSTEM SHALL propagate accumulated exposure `A` across an edge using the exact closed-form leaky-integrator update `A' = A*e^(-dt/tau) + H*tau*(1 - e^(-dt/tau))`, never Euler integration.
2. THE SYSTEM SHALL initialise `A0` from prior walking minutes `P` under unshaded conditions via the closed form from zero.
3. THE SYSTEM SHALL model a cooling/recovery dwell with the same update using the reduced (or zero) rate.
4. THE SYSTEM SHALL compute arrival exposure `A_T` with the late-exposure weighting `e^(-(T - t_i)/tau)` so the result is path-dependent and non-additive.
5. THE SYSTEM SHALL classify `A` into modeled bands (low / elevated / high) using thresholds from config, labelled as modeled and not medical.
6. THE SYSTEM SHALL emit an exposure trace (`aTrace`) along each selected route so the frontend can animate without recomputing exposure.

### R5 Edge cost and personal factor

**User story:** As the engine, I want an additive non-negative edge cost that re-weights heat vs time by the user's state, so that Dijkstra/A* stay correct while personalisation works.

#### R5 acceptance criteria

1. THE SYSTEM SHALL compute walking time per edge from `len/v` with the configured speed and step multiplier.
2. THE SYSTEM SHALL derive a personal factor `pf` from `A0`, simulated HR over baseline, and (when active) the body-temperature delta, as a scalar re-weighting of heat vs time.
3. THE SYSTEM SHALL compute edge cost `c_e = w_t*dt + w_h*pf*H*dt + w_s*S*len/100` with all terms non-negative.
4. THE SYSTEM SHALL set edge cost to infinity WHERE safety exceeds the hard threshold OR (when step-free routing is requested) the edge is tagged as steps.
5. THE SYSTEM SHALL keep cost additive (no negative edges); recovery is a node dwell event, never a negative edge.

### R6 Route search and candidate frontier

**User story:** As the engine, I want exact shortest-path search and a Pareto frontier of candidates, so that the frontend can present fastest, coolest, and balanced options.

#### R6 acceptance criteria

1. THE SYSTEM SHALL implement A* with an admissible, consistent heuristic derived from `c_min` and equirectangular distance, returning the exact Dijkstra optimum.
2. THE SYSTEM SHALL compute supported Pareto-optimal routes in (time, personal heat) via dichotomic weighted-sum search (Aneja-Nair), anchored by the fastest and coolest routes.
3. THE SYSTEM SHALL deduplicate candidates by edge-length overlap above a configured threshold, yielding 2-5 routes.
4. THE SYSTEM SHALL solve mode selection as a constrained shortest path (coolest within a detour cap) using the Lagrangian frontier solution and SHALL document the accepted MVP duality-gap limitation.
5. THE SYSTEM SHALL rank candidates by the normalised cost `J = w_t*T/T_fast + w_h*X/X_fast + w_s*S(R)` after filtering by the mode cap and hard safety, where modes differ only in `(w_t, w_h, w_s, rho)`.
6. THE SYSTEM SHALL report per route: time, distance, heat-minutes, shade %, arrival exposure band, safety indicator, nearby oases, `J`, feasibility, and turns.
7. THE SYSTEM SHALL compute turn instructions from bearing changes above the configured threshold or street-name changes, as descriptors.
8. Identical inputs SHALL produce identical candidate sets and ranking (deterministic tie-breaking by node id).

### R7 Safety field

**User story:** As the engine, I want a safety field over edges, so that routes avoid flagged zones lexicographically before comfort.

#### R7 acceptance criteria

1. THE SYSTEM SHALL score each edge against safety zones with a Gaussian kernel `S_e = max_z q_z * exp(-(d/r_z)^2)`.
2. THE SYSTEM SHALL treat safety zones as SIMULATED and label them as such in emitted data.
3. THE SYSTEM SHALL never route through edges above the hard safety threshold when an alternative exists.
4. IF excluding hard-unsafe edges disconnects start and goal THE SYSTEM SHALL route without the block and return a warning descriptor.
5. THE SYSTEM SHALL accept zones supplied in the request (dropped by the user in the Lab) and seeded zones from presets.

### R8 Rerouting and offers

**User story:** As the engine, I want cheap rerouting and consent-based offers, so that playback can adapt without ever forcing a switch.

#### R8 acceptance criteria

1. WHEN scenario weights change THE SYSTEM SHALL run one backward Dijkstra from the destination to produce `dist_to_goal` and `next_hop` for every node, and cache the backward tree keyed by `hash(scenario, goal)`.
2. WHEN the walker's position is supplied THE SYSTEM SHALL derive the best remaining route by pointer-following in O(path length), without a new search.
3. THE SYSTEM SHALL emit an offer (never an automatic switch) only when `J_new < (1 - eps)*J_current`, with configured hysteresis `eps`.
4. THE SYSTEM SHALL emit a high-priority offer when the current remaining path contains a hard-unsafe edge.
5. THE SYSTEM SHALL include in each offer: delta time, delta heat, delta J, trigger, expiry, and a snooze key per offer kind.
6. THE SYSTEM SHALL support snooze per offer kind so a "not now" answer suppresses that kind until re-armed.

### R9 Cooling stops (via-stop)

**User story:** As the engine, I want to evaluate cooling stops with two trees, so that a high-exposure arrival can be reduced by a short detour.

#### R9 acceptance criteria

1. THE SYSTEM SHALL compute a forward tree from start and a backward tree from goal (one Dijkstra each).
2. THE SYSTEM SHALL evaluate every resource in O(#resources) via `cost_via(r) = D_s[n_r] + D_t[n_r] + dwell_cost(r)`, with no extra searches.
3. WHEN projected arrival exposure is high THE SYSTEM SHALL compute `A_T` with a dwell segment for each resource and offer the best stop within the detour cap when `A_T` drops by at least the configured delta.

### R10 Body estimate and escalation reducer

**User story:** As the engine, I want a transparent core-temperature heuristic and a pure escalation state machine, so that the alert flow can be demonstrated honestly and deterministically.

#### R10 acceptance criteria

1. THE SYSTEM SHALL compute `Tc_model = Tc0 + k_A*A + k_HR*clamp((HR - HR_base)/HR_base, 0, 1)` and return it with a range `+/- r`, flagged "illustrative model" (or SIMULATED when sourced from the wearable).
2. THE SYSTEM SHALL use the simulated wearable reading `Tc_obs` as `Tc_used` when the wearable is active, otherwise `Tc_model`.
3. WHEN `Tc_obs - Tc_model > m` THE SYSTEM SHALL raise the personal factor by `1 + gamma*(delta/m)` capped at `pf_max` and signal a reroute/break offer.
4. THE SYSTEM SHALL implement `core/escalation.ts` as a pure function `(state, Tc_used, now, userAction) -> state` with no internal timers; `now` is an input.
5. THE SYSTEM SHALL transition normal -> caution at `T1`, caution -> countdown at `T2`, countdown -> dispatch_sim on expiry, countdown -> snoozed on cancel, snoozed -> countdown on re-arm or timer, and step down with the configured hysteresis.
6. THE SYSTEM SHALL return a `deadlineMs` for the countdown so the frontend can complete it locally if the API becomes unavailable.
7. THE SYSTEM SHALL make no network request for the simulated dispatch; it only describes the data that would be shared.

### R11 Explanations

**User story:** As the engine, I want rule-based explanations, so that the frontend can show why a route was recommended without an LLM.

#### R11 acceptance criteria

1. THE SYSTEM SHALL produce explanation descriptors from computed metrics using a fixed rule table (shade diff, fastest-loses-on-heat, A0-changed-ranking, via-stop offered, safety block). No LLM.
2. THE SYSTEM SHALL compute the fresh-walker ranking within the same request so the "changed vs fresh" rule is computed rather than assumed.

### R12 Coverage and departure planner

**User story:** As the engine, I want equity coverage and a departure planner, so that cities and users can see access to cooling and the best time to walk.

#### R12 acceptance criteria

1. THE SYSTEM SHALL compute walking minutes to the nearest oasis for every node via one multi-source Dijkstra, and summarise the share of streets within 5 and 10 minutes.
2. THE SYSTEM SHALL suggest the top k new fountain/shade locations by deterministic greedy max-coverage, labelled as a heuristic with documented proxy weights.
3. THE SYSTEM SHALL evaluate the best route across the day in configured time steps and return a curve of best-route heat-minutes vs departure time plus the argmin window.

### R13 API contract

**User story:** As both owners, I want a single shared contract, so that the frontend can build on mock data and switch to live without surprises.

#### R13 acceptance criteria

1. THE SYSTEM SHALL define zod schemas in `backend/contract/schemas.ts` as the source of truth for every request and response.
2. THE SYSTEM SHALL implement `GET /api/meta`, `/api/config`, `/api/presets`, `/api/layers/:name`, and `POST /api/plan`, `/api/replan`, `/api/body`, `/api/escalation/step`, `/api/coverage`, `/api/departure`.
3. THE SYSTEM SHALL expose all thresholds, limits, bands, speeds, event sizes, and countdown length through `/api/config` so the frontend hardcodes none of them.
4. THE SYSTEM SHALL emit all user-facing text as `Descriptor { key, vars }`, never sentences, and every key SHALL exist in `backend/contract/messages.json`.
5. THE SYSTEM SHALL return HTTP 400/422 with an `ApiError` body on invalid input.
6. WHERE an endpoint still returns a fixture rather than computed data THE SYSTEM SHALL set the response header `X-Oasyn-Stub: true`.
7. THE SYSTEM SHALL keep post-hour-0 contract changes additive (new optional fields or endpoints) and bump `CONTRACT_VERSION` and `/api/meta.contractVersion` on any breaking change.
8. THE SYSTEM SHALL ship validated sample fixtures under `backend/contract/fixtures/` marked `kind: "sample"`.

### R14 Configuration and no hardcoding

**User story:** As the backend owner, I want every constant in one place, so that behaviour is tunable and the no-hardcode rule is enforceable.

#### R14 acceptance criteria

1. THE SYSTEM SHALL define every model constant, threshold, band, weight, speed, limit, event size, and seed in `backend/src/config.ts`.
2. THE SYSTEM SHALL emit no sentence string literals from `backend/src/core` (descriptors only), enforceable by a lint script.
3. THE SYSTEM SHALL round coordinates to 2 decimals before any outbound weather request and SHALL send no UUID or identifier to any third party.
4. THE SYSTEM SHALL run statelessly: it stores nothing between requests and logs no coordinates or identifiers.

### R15 Performance and caching

**User story:** As the backend owner, I want the engine to stay within budget, so that interactive scenario changes feel instant.

#### R15 acceptance criteria

1. THE SYSTEM SHALL memoise plan results in a small server-side LRU keyed by `hash(scenario, start, goal, mode)`.
2. THE SYSTEM SHALL cache backward trees by `hash(scenario, goal)` for `/api/replan`.
3. THE SYSTEM SHALL recompute only `H` and `S` per scenario; static features load once at start.
4. THE SYSTEM SHALL meet the documented step budgets (edge-heat build < 2 ms, A* ~1-5 ms, frontier < 30 ms, trees ~10 ms, reroute O(path)).

### R16 Headless CLI and Kiro evidence

**User story:** As the backend owner, I want a headless entry point and Kiro artifacts, so that scenarios run without the HTTP server and the Kiro workflow is evidenced.

#### R16 acceptance criteria

1. THE SYSTEM SHALL provide `backend/scripts/plan-cli.mjs` that imports `backend/src/core` (via `tsx`) and runs a scenario headlessly.
2. THE SYSTEM SHALL include backend steering scoped to `backend/src/core/**`, this spec, backend hooks, and `KIRO_LOG.md` entries for backend work.

### R17 Testing

**User story:** As the backend owner, I want a deterministic test suite, so that correctness properties hold and the contract stays valid.

#### R17 acceptance criteria

1. THE SYSTEM SHALL test exposure properties: `H` monotone in `I` and `sigma`; exact update matches the closed form; `A` bounded by `H*tau`; decay toward zero when `H = 0`.
2. THE SYSTEM SHALL test that A* equals Dijkstra on seeded random small graphs, that blocked edges are never used, and that contraction preserves shortest-path length.
3. THE SYSTEM SHALL test that all frontier candidates are non-dominated and that the endpoints are the fastest and coolest routes.
4. THE SYSTEM SHALL test scoring (higher `A0` raises `pf`; coolest picks lower heat within the cap; hard safety is never overridden), rerouting (no offer below the hysteresis margin; offer not switch on hard block; snooze respected), the escalation reducer with a fake clock (all transitions, re-arm only after the delta, downward hysteresis), the body estimate (monotonicity; delta triggers an offer only above the margin), and coverage (multi-source distances equal the min over single-source runs).
5. THE SYSTEM SHALL fail the test run if any fixture breaks its schema or references a message key missing from `messages.json`.
