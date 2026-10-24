/**
 * contract/schemas.ts — the single source of truth for every request and
 * response the Oasyn backend accepts or emits (R13.1).
 *
 * Rules:
 *  - All user-facing text crosses the wire as Descriptor { key, vars }, never a
 *    sentence (R13.4). Keys must exist in messages.json (checked by contract.test.ts).
 *  - Post-hour-0 changes are additive (new optional fields / endpoints); any
 *    breaking change bumps CONTRACT_VERSION (R13.7).
 */

import { z } from "zod";

/**
 * Contract version. Bump the MAJOR on any breaking change (R13.7); additive
 * changes (new optional fields/endpoints) bump the MINOR.
 * 0.2.0 — added optional ReplanRequest.current (remaining committed-route
 *         metrics) enabling the hysteresis reroute offer. Additive/non-breaking.
 * 0.3.0 — added GET /api/search (place / park / cooling / address lookup for
 *         start and destination). Additive/non-breaking.
 */
export const CONTRACT_VERSION = "0.3.0";

// ---------------------------------------------------------------------------
// Primitives and shared types
// ---------------------------------------------------------------------------

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

/** A translatable descriptor. The frontend renders it via t(key, vars). */
export const Descriptor = z.object({
  key: z.string().min(1),
  vars: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type Descriptor = z.infer<typeof Descriptor>;

/** A SIMULATED safety zone (R7.2). */
export const Zone = z.object({
  center: LatLng,
  /** intensity q_z in [0,1]. */
  q: z.number().min(0).max(1),
  /** radius r_z in metres. */
  r: z.number().positive(),
  simulated: z.literal(true),
});
export type Zone = z.infer<typeof Zone>;

export const Mode = z.enum(["fastest", "balanced", "coolest"]);
export type Mode = z.infer<typeof Mode>;

/** Scenario: everything about the world state for a request. Time is an input. */
export const Scenario = z.object({
  /** ISO timestamp; core/ reads time only from here (determinism principle). */
  timeISO: z.string().datetime({ offset: true }),
  /** Air temperature, deg C. */
  tempC: z.number(),
  /** Relative humidity, percent. */
  rh: z.number().min(0).max(100),
  /** Cloud fraction in [0,1]. */
  cloud: z.number().min(0).max(1),
  /** Optional live shortwave radiation, W/m^2. */
  radiation: z.number().min(0).optional(),
  /** Prior walking minutes used to seed A0. */
  priorWalkMin: z.number().min(0).default(0),
  /** Simulated heart rate, bpm. */
  hr: z.number().positive().optional(),
  /** Request step-free routing (avoid stairs). */
  stepFree: z.boolean().default(false),
  /** SIMULATED zones dropped in the Lab or seeded by a preset. */
  zones: z.array(Zone).default([]),
  /** Ask the backend to fetch live weather (backend-owned, R3.8). */
  liveWeather: z.boolean().default(false),
});
export type Scenario = z.infer<typeof Scenario>;

/** A turn instruction as a descriptor plus geometry anchor (R6.7). */
export const Turn = z.object({
  at: LatLng,
  descriptor: Descriptor,
  /** bearing change in degrees, signed. */
  bearingDelta: z.number(),
});
export type Turn = z.infer<typeof Turn>;

/** A nearby cooling resource surfaced on a route. */
export const OasisHit = z.object({
  id: z.string(),
  at: LatLng,
  name: Descriptor,
  kind: z.enum(["cooling", "water", "park"]),
  distanceM: z.number().min(0),
  simulated: z.boolean(),
});
export type OasisHit = z.infer<typeof OasisHit>;

export const ExposureBand = z.enum(["low", "elevated", "high"]);
export type ExposureBand = z.infer<typeof ExposureBand>;

/** One computed route candidate (R6.6). */
export const RouteResult = z.object({
  id: z.string(),
  mode: Mode,
  geometry: z.array(LatLng),
  timeSec: z.number().min(0),
  distanceM: z.number().min(0),
  heatMinutes: z.number().min(0),
  shadePct: z.number().min(0).max(100),
  arrivalBand: ExposureBand,
  /** Max safety-field value along the route in [0,1]. */
  safetyMax: z.number().min(0).max(1),
  oases: z.array(OasisHit),
  /** Normalised rank cost J. */
  j: z.number().min(0),
  feasible: z.boolean(),
  turns: z.array(Turn),
  /** triples [timeSec, distanceM, A] for playback (R4.6). */
  aTrace: z.array(z.tuple([z.number(), z.number(), z.number()])),
  explanations: z.array(Descriptor),
});
export type RouteResult = z.infer<typeof RouteResult>;

/** A consent-based offer (never an automatic switch) (R8.5). */
export const Offer = z.object({
  kind: z.enum(["reroute", "via_stop", "safety", "break"]),
  deltaTimeSec: z.number(),
  deltaHeatMinutes: z.number(),
  deltaJ: z.number(),
  trigger: Descriptor,
  /** absolute ms epoch after which the offer expires. */
  expiryMs: z.number(),
  snoozeKey: z.string(),
  priority: z.enum(["normal", "high"]).default("normal"),
  routeId: z.string().optional(),
});
export type Offer = z.infer<typeof Offer>;

/** A reroute event emitted during playback. */
export const RerouteEvent = z.object({
  atMs: z.number(),
  offer: Offer,
});
export type RerouteEvent = z.infer<typeof RerouteEvent>;

// ---------------------------------------------------------------------------
// Errors (R13.5)
// ---------------------------------------------------------------------------

export const ApiError = z.object({
  error: z.literal(true),
  status: z.number(),
  code: z.string(),
  message: Descriptor,
  issues: z.array(z.object({ path: z.string(), message: Descriptor })).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

// ---------------------------------------------------------------------------
// Provenance (R2.3)
// ---------------------------------------------------------------------------

export const Provenance = z.object({
  name: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
  kind: z.enum(["real", "sample", "simulated", "derived"]),
  notes: z.string().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

// ---------------------------------------------------------------------------
// GET /api/meta  (R13.2)
// ---------------------------------------------------------------------------

export const MetaResponse = z.object({
  contractVersion: z.string(),
  layers: z.array(Provenance),
  nodes: z.number().int().nonnegative().optional(),
  edges: z.number().int().nonnegative().optional(),
});
export type MetaResponse = z.infer<typeof MetaResponse>;

// ---------------------------------------------------------------------------
// GET /api/config  (R13.3)
// ---------------------------------------------------------------------------

/** The public config is passed through as-is; schema stays permissive. */
export const ConfigResponse = z.record(z.any());
export type ConfigResponse = z.infer<typeof ConfigResponse>;

// ---------------------------------------------------------------------------
// GET /api/presets  (R13.2)
// ---------------------------------------------------------------------------

export const Preset = z.object({
  id: z.string(),
  label: Descriptor,
  scenario: Scenario,
});
export const Trip = z.object({
  id: z.string(),
  label: Descriptor,
  from: LatLng,
  to: LatLng,
});
export const PresetsResponse = z.object({
  weather: z.array(Preset),
  trips: z.array(Trip),
  zones: z.array(Zone),
});
export type PresetsResponse = z.infer<typeof PresetsResponse>;

// ---------------------------------------------------------------------------
// GET /api/layers/:name  (R13.2)
// ---------------------------------------------------------------------------

export const LayerName = z.enum(["parks", "trees", "water", "cooling", "places"]);
export type LayerName = z.infer<typeof LayerName>;

export const LayerResponse = z.object({
  name: LayerName,
  provenance: Provenance,
  /** GeoJSON-ish FeatureCollection; kept permissive to avoid over-constraining geometry. */
  features: z.array(z.record(z.any())),
});
export type LayerResponse = z.infer<typeof LayerResponse>;

// ---------------------------------------------------------------------------
// GET /api/search?q=&limit=&lang=  (start / destination lookup)
// ---------------------------------------------------------------------------

/** Query parameters (strings on the wire; coerced here). */
export const SearchRequest = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(10).default(8),
  /** UI language hint for geocoder labels; unknown values fall back to "en". */
  lang: z.string().max(16).optional(),
});
export type SearchRequest = z.infer<typeof SearchRequest>;

export const SearchKind = z.enum(["place", "park", "cooling", "water", "poi", "address"]);
export type SearchKind = z.infer<typeof SearchKind>;

/**
 * One match. `name` and `detail` are map DATA (OSM / city GIS names and
 * addresses, kept as mapped per R12.5), not UI sentences, so they are plain
 * strings rather than descriptors.
 */
export const SearchResult = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** secondary line, e.g. street address or neighbourhood. */
  detail: z.string().optional(),
  at: LatLng,
  kind: SearchKind,
  /** "local" = snapshot layers; "geocoder" = OSM geocoder (Photon). */
  source: z.enum(["local", "geocoder"]),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const SearchResponse = z.object({
  query: z.string(),
  results: z.array(SearchResult),
  /** true when the geocoder was unavailable and only local data was searched. */
  degraded: z.boolean().default(false),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

// ---------------------------------------------------------------------------
// POST /api/plan  (R13.2)
// ---------------------------------------------------------------------------

export const PlanRequest = z.object({
  from: LatLng,
  to: LatLng,
  mode: Mode.default("balanced"),
  scenario: Scenario,
});
export type PlanRequest = z.infer<typeof PlanRequest>;

export const PlanResponse = z.object({
  routes: z.array(RouteResult),
  recommendedId: z.string().nullable(),
  /** present when start/goal could not be connected (R1.5). */
  noPath: Descriptor.optional(),
  /** present when the hard-safety mask was dropped to keep connectivity (R7.4). */
  warning: Descriptor.optional(),
  offers: z.array(Offer),
});
export type PlanResponse = z.infer<typeof PlanResponse>;

// ---------------------------------------------------------------------------
// POST /api/replan  (R13.2)
// ---------------------------------------------------------------------------

/**
 * Metrics of the route the walker is currently committed to, measured for the
 * REMAINING portion from `position` to `goal`. The frontend echoes these from
 * the originally planned RouteResult so the backend can decide whether a better
 * route warrants a reroute offer (J_new < (1-eps)*J_current). Optional and
 * additive (R13.7): when omitted, the backend emits only the safety offer.
 */
export const CurrentRouteMetrics = z.object({
  timeSec: z.number().min(0),
  heatMinutes: z.number().min(0),
  /** pf-weighted heat-minutes (the frontier objective X); optional. */
  personalHeat: z.number().min(0).optional(),
  safetyMax: z.number().min(0).max(1),
});
export type CurrentRouteMetrics = z.infer<typeof CurrentRouteMetrics>;

export const ReplanRequest = z.object({
  goal: LatLng,
  position: LatLng,
  mode: Mode.default("balanced"),
  scenario: Scenario,
  /** snooze keys the user has silenced. */
  snoozed: z.array(z.string()).default([]),
  /** remaining committed-route metrics, for the hysteresis reroute offer (R8.3). */
  current: CurrentRouteMetrics.optional(),
});
export type ReplanRequest = z.infer<typeof ReplanRequest>;

export const ReplanResponse = z.object({
  remaining: RouteResult.nullable(),
  offers: z.array(Offer),
  noPath: Descriptor.optional(),
});
export type ReplanResponse = z.infer<typeof ReplanResponse>;

// ---------------------------------------------------------------------------
// POST /api/body  (R13.2)
// ---------------------------------------------------------------------------

export const BodyRequest = z.object({
  /** accumulated exposure A at the moment of estimate. */
  a: z.number().min(0),
  hr: z.number().positive(),
  /** simulated wearable reading, deg C. */
  tcObs: z.number().optional(),
  wearableOn: z.boolean().default(false),
});
export type BodyRequest = z.infer<typeof BodyRequest>;

export const BodyResponse = z.object({
  tcModel: z.number(),
  tcUsed: z.number(),
  rangeLow: z.number(),
  rangeHigh: z.number(),
  band: ExposureBand,
  pfUplift: z.number(),
  /** "illustrative model" or SIMULATED when sourced from the wearable. */
  label: Descriptor,
  simulated: z.boolean(),
});
export type BodyResponse = z.infer<typeof BodyResponse>;

// ---------------------------------------------------------------------------
// POST /api/escalation/step  (R13.2)
// ---------------------------------------------------------------------------

export const EscalationPhase = z.enum(["normal", "caution", "countdown", "snoozed", "dispatch_sim"]);
export type EscalationPhase = z.infer<typeof EscalationPhase>;

export const EscalationState = z.object({
  phase: EscalationPhase,
  deadlineMs: z.number().optional(),
  tcAtSnooze: z.number().optional(),
  snoozeUntilMs: z.number().optional(),
});
export type EscalationState = z.infer<typeof EscalationState>;

export const EscalationRequest = z.object({
  state: EscalationState,
  tcUsed: z.number(),
  nowMs: z.number(),
  action: z.enum(["cancel", "none"]).default("none"),
});
export type EscalationRequest = z.infer<typeof EscalationRequest>;

export const EscalationResponse = z.object({
  state: EscalationState,
  /** descriptor of the (simulated) data a dispatch would share (R10.7). */
  dispatchInfo: Descriptor.optional(),
  simulated: z.literal(true),
});
export type EscalationResponse = z.infer<typeof EscalationResponse>;

// ---------------------------------------------------------------------------
// POST /api/coverage  (R13.2)
// ---------------------------------------------------------------------------

export const CoverageRequest = z.object({
  scenario: Scenario,
  suggestK: z.number().int().positive().optional(),
});
export type CoverageRequest = z.infer<typeof CoverageRequest>;

export const CoverageResponse = z.object({
  within5Pct: z.number().min(0).max(100),
  within10Pct: z.number().min(0).max(100),
  /** per-node nearest-oasis minutes, thinned for display. */
  samples: z.array(z.object({ at: LatLng, minutes: z.number().min(0) })),
  suggestions: z.array(
    z.object({ at: LatLng, label: Descriptor, benefit: z.number() }),
  ),
  heuristicNote: Descriptor,
});
export type CoverageResponse = z.infer<typeof CoverageResponse>;

// ---------------------------------------------------------------------------
// POST /api/departure  (R13.2)
// ---------------------------------------------------------------------------

export const DepartureRequest = z.object({
  from: LatLng,
  to: LatLng,
  mode: Mode.default("balanced"),
  scenario: Scenario,
});
export type DepartureRequest = z.infer<typeof DepartureRequest>;

export const DepartureResponse = z.object({
  points: z.array(z.object({ tISO: z.string(), heatMin: z.number().min(0) })),
  best: z.object({ tISO: z.string(), reductionPct: z.number() }),
});
export type DepartureResponse = z.infer<typeof DepartureResponse>;
