# Oasyn backend — sample API (Hour 1 stub)

This is the **stub** backend for the frontend team to build against during Hour 1.
Every endpoint returns a **validated sample fixture** that matches the real zod
contract (`backend/contract/schemas.ts`). Stubbed responses carry the header
`X-Oasyn-Stub: true`.

- Base URL (test deploy): `https://<your-render-service>.onrender.com`
- Contract version: `0.1.0` (see `GET /api/meta` / `GET /healthz`)
- CORS: open (`*`) on the test deploy.
- Note: the free Render instance sleeps when idle; the first request after a
  nap can take ~30–50 s to wake. Subsequent requests are fast.

All user-facing text is a `Descriptor { key, vars? }` — never a sentence. Render
it via your `t(key, vars)`. Keys are catalogued in
`backend/contract/messages.json`.

---

## Health / discovery

| Method | Path       | Notes                                   |
| ------ | ---------- | --------------------------------------- |
| GET    | `/`        | Service index + endpoint list           |
| GET    | `/healthz` | `{ ok, contractVersion, stub }`         |

---

## GET endpoints (no body)

### `GET /api/meta`
Provenance + contract version. Returns `MetaResponse`.

### `GET /api/config`
The public config slice — **all thresholds, bands, weights, speeds, caps,
countdown length** the frontend needs. The frontend must hardcode none of these;
read them from here. This endpoint is **real** (no stub header).

### `GET /api/presets`
Weather scenarios, trips, and seeded SIMULATED safety zones. Returns
`PresetsResponse`.

### `GET /api/layers/:name`
`name` ∈ `parks | trees | water | cooling | places`. Returns a `LayerResponse`
(GeoJSON-ish features + provenance). Unknown names → 400 `ApiError`.

---

## POST endpoints

All POSTs validate the request body against the schema and return 422 `ApiError`
with descriptor messages on invalid input. Bodies below are minimal valid
examples.

### `POST /api/plan`
Returns `PlanResponse` (routes, recommendedId, offers).
```json
{
  "from": { "lat": 42.348, "lng": -71.081 },
  "to":   { "lat": 42.3398, "lng": -71.0892 },
  "mode": "balanced",
  "scenario": {
    "timeISO": "2026-07-21T14:00:00-04:00",
    "tempC": 36, "rh": 45, "cloud": 0.1,
    "priorWalkMin": 15, "hr": 88,
    "stepFree": false, "zones": [], "liveWeather": false
  }
}
```

### `POST /api/replan`
Returns `ReplanRequest` → `ReplanResponse` (remaining route + offers).
```json
{
  "goal": { "lat": 42.3398, "lng": -71.0892 },
  "position": { "lat": 42.3451, "lng": -71.0858 },
  "mode": "balanced",
  "scenario": { "timeISO": "2026-07-21T14:00:00-04:00", "tempC": 36, "rh": 45, "cloud": 0.1 },
  "snoozed": []
}
```

### `POST /api/body`
Returns `BodyResponse` (modeled core temp, band, pf uplift).
```json
{ "a": 0.4, "hr": 92, "tcObs": 38.1, "wearableOn": false }
```

### `POST /api/escalation/step`
Returns `EscalationResponse` (next state + optional dispatch descriptor).
```json
{
  "state": { "phase": "caution" },
  "tcUsed": 39.2,
  "nowMs": 1792000000000,
  "action": "none"
}
```

### `POST /api/coverage`
Returns `CoverageResponse` (within-5/10-min %, samples, suggestions).
```json
{ "scenario": { "timeISO": "2026-07-21T14:00:00-04:00", "tempC": 36, "rh": 45, "cloud": 0.1 }, "suggestK": 3 }
```

### `POST /api/departure`
Returns `DepartureResponse` (heat-minutes vs departure-time curve + best window).
```json
{
  "from": { "lat": 42.348, "lng": -71.081 },
  "to":   { "lat": 42.3398, "lng": -71.0892 },
  "mode": "balanced",
  "scenario": { "timeISO": "2026-07-21T08:00:00-04:00", "tempC": 24, "rh": 60, "cloud": 0.4 }
}
```

---

## Reminders for the frontend

- Treat `X-Oasyn-Stub: true` as "this is sample data"; it disappears per endpoint
  as the real engine comes online in later hours.
- The response **shapes are stable** (the contract). Only the *values* change
  when the real engine lands, and any change will be additive (R13.7).
- The canonical source for request/response shapes is
  `backend/contract/schemas.ts`; fixtures live in `backend/contract/fixtures/`.
