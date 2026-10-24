---
inclusion: fileMatch
fileMatchPattern: "backend/src/core/**"
---

# Oasyn backend engine (`backend/src/core/**`) — steering

This guidance applies when editing the deterministic routing engine. It encodes
the non-negotiable rules from the backend spec (`.kiro/specs/oasyn-backend`) so
engine code stays correct and honest.

## Determinism (hard rules)

- **No wall-clock reads.** No `Date.now()`, no no-arg `new Date()`. Time arrives
  as an input (`timeMs` / `nowMs`). `new Date(timeMs)` to feed a library (e.g.
  suncalc) is fine — it is deterministic.
- **No `Math.random`.** Randomness comes from `rng.ts` (mulberry32, seeded from
  `config.seed`) and is used only in the build script, never in request handling.
- **Ties break by node id.** Every heap, sort, and selection resolves equal keys
  by the lower node id so identical inputs yield identical routes.
- `lint:nohardcode` enforces the first two and bans sentence literals; keep it green.

## Honesty (hard rules)

- **Descriptors, not sentences.** Core emits `Descriptor { key, vars }`. Every
  key must exist in `contract/messages.json`. Never put user-facing prose in core.
- Heat exposure is **estimated**; `Tc_model` and personal scores are **modeled
  indicators**, not medical facts. Simulated features (safety zones, wearable,
  dispatch) must stay labelled simulated in emitted data.

## Config is the single source of truth

- Every tunable constant lives in `backend/src/config.ts` and is imported, never
  duplicated. Formula coefficients that map to `math.md` live beside their use
  but should still be named; prefer config for anything a tuner would touch.

## Key formulas (mirror of math.md)

- Heat rate: `H = theta * (k0 + (1 - k0) * I * (1 - alpha * sigma))`,
  guaranteeing `H in [0,1]`, `dH/dI >= 0`, `dH/dsigma <= 0`.
- Shade: probabilistic union `sigma = 1 - (1 - sigma_canopy)(1 - sigma_building)`,
  building shade rising at low sun.
- Exposure (exact closed form, never Euler):
  `A' = A*e^(-dt/tau) + H*(1 - e^(-dt/tau))`.
- Edge cost (all terms non-negative; recovery is a node dwell, never a negative
  edge): `c_e = w_t*dt + w_h*pf*H*dt + w_s*S*len/100`; `Infinity` on hard safety
  or a step edge when step-free routing is on.
- A* heuristic must stay admissible/consistent: `c_min * equirectDist * 0.995`.

## Performance

- Static CSR arrays load once; only `H` and `S` recompute per scenario (O(E)).
- The hot path is goal-directed A* — keep it allocation-light. Full Dijkstra
  trees and multi-source scale with graph size; bound them (see
  `boundedDijkstra`) when only a local region matters.

## Testing

- Every property above is covered by a test under `backend/test`. When you touch
  a formula, update or add the property test; do not weaken a property to make a
  test pass.
