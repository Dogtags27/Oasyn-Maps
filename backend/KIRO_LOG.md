# Kiro log — Oasyn backend

One line per hour of backend work, capturing what Kiro built and verified.

- **Hour 1 — Scaffold, contract, config, data.** Standalone backend package;
  `config.ts` (every constant + `publicConfig`); zod contract (`schemas.ts`,
  `messages.json`, fixtures, README); stub server with `X-Oasyn-Stub`; contract
  test gate; tiled Overpass build script.
- **Hour 2 — Graph build, binary snapshot, CSR, A*.** 25 m grid-hash feature
  baking + degree-2 contraction (805,877→203,772 nodes); compact binary CSR
  snapshot (`graph.bin`, ~13.6 MB vs ~170 MB JSON) published to Cloudflare R2;
  CSR load + grid-hash snap; A*/Dijkstra with binary heap; live layer endpoints.
- **Hour 3 — Heat, exposure, cost, frontier, scoring, real `/api/plan`.**
  Environment model (sun, I, theta, shade, H); exact leaky-integrator exposure;
  additive edge cost + personal factor; Aneja-Nair frontier; J scoring; turns +
  rule-based explanations; the real plan pipeline (Checkpoint 1).
- **Hour 4 — Body, escalation, offers, via-stop, replan.** Illustrative
  `Tc_model`; pure escalation reducer (fake-clock tested); backward-tree reroute
  with hysteresis + safety offers and per-kind snooze; two-tree cooling via-stops;
  LRU + stable hashing (Checkpoint 2). Closed the reroute seam with an additive
  `ReplanRequest.current` (CONTRACT_VERSION 0.2.0).
- **Hour 5 — Coverage, departure, performance, hardening.** Multi-source oasis
  coverage + greedy max-coverage suggestions; across-day departure curve; perf
  pass with measured budgets + plan-result LRU; headless `plan-cli`; expanded
  no-hardcode/determinism guard (Checkpoint 3).
- **Hour 6 — Tuning, fixtures, docs, Kiro evidence.** Live-engine fixture
  regeneration (`npm run fixtures`) + bounded-Dijkstra coverage speedup; backend
  steering, hooks, and this log; documented the LARAC duality-gap limitation and
  confirmed provenance/simulation labelling across emitted data.
