# Oasyn contract

`backend/contract/` is the only shared surface between the backend and frontend
specs. The frontend contains no domain logic and no thresholds; everything it
displays or thresholds on comes from this contract and `/api/config`.

## Files

- `schemas.ts` — zod schemas, the source of truth for every request and response
  (R13.1). Exports `CONTRACT_VERSION`.
- `messages.json` — every descriptor key the backend can emit, with example vars
  (R13.4). Frontend-owned namespaces (`mode.*`, `preset.*`, `trip.*`) are
  documented but never emitted by the backend.
- `fixtures/*.json` — one validated sample response per endpoint, `kind: "sample"`,
  with illustrative Back Bay / Northeastern geometry and `"Sample ..."` resource
  names (R13.8, R2.7).

## Rules (enforced by `test/contract.test.ts`)

1. **Schemas are the source of truth.** Every request is validated on the way in;
   every response is validated in dev on the way out.
2. **Fixtures validate against their schema.** The contract test parses each
   fixture's `response` with its schema and fails on any mismatch.
3. **Descriptors only — no sentences.** All user-facing text crosses the wire as
   `Descriptor { key, vars }`. Every key used anywhere in the fixtures must exist
   in `messages.json`, or the test fails (R13.4).
4. **Stub header.** While an endpoint returns a fixture rather than computed data
   it sets `X-Oasyn-Stub: true` (R13.6). The header is dropped when the real
   engine backs the endpoint.
5. **Additive after hour 0.** Post-hour-0 changes add optional fields or new
   endpoints only. Any breaking change bumps `CONTRACT_VERSION` here and
   `/api/meta.contractVersion` (R13.7).
6. **Errors.** Invalid input returns HTTP 400/422 with an `ApiError` body whose
   `message` and `issues[].message` are descriptors (R13.5).

## Endpoints

| Method | Path                    | Request schema      | Response schema      |
| ------ | ----------------------- | ------------------- | -------------------- |
| GET    | `/api/meta`             | —                   | `MetaResponse`       |
| GET    | `/api/config`           | —                   | `ConfigResponse`     |
| GET    | `/api/presets`          | —                   | `PresetsResponse`    |
| GET    | `/api/layers/:name`     | `LayerName` (param) | `LayerResponse`      |
| POST   | `/api/plan`             | `PlanRequest`       | `PlanResponse`       |
| POST   | `/api/replan`           | `ReplanRequest`     | `ReplanResponse`     |
| POST   | `/api/body`             | `BodyRequest`       | `BodyResponse`       |
| POST   | `/api/escalation/step`  | `EscalationRequest` | `EscalationResponse` |
| POST   | `/api/coverage`         | `CoverageRequest`   | `CoverageResponse`   |
| POST   | `/api/departure`        | `DepartureRequest`  | `DepartureResponse`  |
