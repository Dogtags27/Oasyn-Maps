# Oasyn backend — limitations and honesty notes

This document states, plainly, what the backend models, what it does not, and
where known approximations live. It satisfies the honesty pass (task 32) and the
determinism/honesty principles in the spec.

## Modeling limitations

### Coolest-within-cap: duality gap (R6.4)

The candidate frontier is built with the Aneja-Nair dichotomic weighted-sum
method, which finds only **supported** Pareto-optimal routes — points on the
lower convex hull of the time-vs-personal-heat trade-off. "Coolest within the
detour cap" is then selected from those supported points.

A true constrained-shortest-path optimum can fall in a **duality gap**: a
non-supported route that is strictly cooler than any supported route while still
inside the time cap. We accept this gap for the MVP. Closing it exactly requires
a state-dependent search over `(node, bucket(A))` (math.md §5.4), left as a
stretch item. For walking graphs the gap is small, so the supported pick is a
close, fast approximation — not a guaranteed optimum.

### Estimated heat, not measured

Heat exposure is **estimated** from available data (sun geometry, cloud/apparent
temperature, and baked canopy/park/building shade features), not measured in the
field. Shade features come from OpenStreetMap, whose tree/park coverage is
uneven, so on sparsely-mapped corridors the heat field is near-uniform and the
"coolest" route can coincide with the fastest. This is a data-density limitation,
not an engine error.

### Modeled indicators, not medical facts

`Tc_model` (core temperature), the exposure bands, and the personal factor are
**modeled indicators**. They are returned labelled "illustrative model" (or
SIMULATED when sourced from the simulated wearable) and must never be presented
as medical assessments.

## Honesty invariants (enforced)

- **Provenance on every layer.** `data/meta.json` records `{name, url,
  retrievedAt, kind, notes}` per layer; `/api/layers/:name` attaches that
  provenance to every response.
- **Simulated features are labelled.** Safety zones carry `simulated: true`
  (schema-enforced); the body response carries an illustrative/simulated label;
  the escalation dispatch is a terminal `dispatch_sim` state that makes **no
  network request** and only describes the data that would be shared, flagged
  simulated. Cooling/water resources default `status: "unknown"` (R2.7) so they
  are not mistaken for authoritative real-time facility data.
- **Determinism.** No wall-clock reads or `Math.random` in `core/`; time and
  randomness are inputs; ties break by node id. Enforced by `lint:nohardcode`.
- **Privacy / statelessness.** Nothing persists between requests; logs carry no
  coordinates or identifiers; outbound weather (if used) rounds coordinates to 2
  decimals and sends no identifier.
