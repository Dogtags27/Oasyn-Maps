/**
 * config.ts — the single source of truth for every model constant, threshold,
 * band, weight, speed, limit, event size, and seed used by the Oasyn backend.
 *
 * R14.1: every constant lives here. No constant is duplicated in routes/ or core/.
 * R13.3: the `publicConfig` slice is what `/api/config` exposes so the frontend
 * hardcodes none of these values.
 *
 * Symbols map to the plan's math.md. Comments name the symbol where it helps.
 */

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

/**
 * Bounding box for the data snapshot: Greater Boston inner metro, ~600 km²
 * (~24.5 km x 24.5 km) centered on (42.341, -71.084). Covers Boston, Cambridge,
 * Somerville, Brookline, Chelsea, Everett, and the inner ring.
 *   dLat = +/-0.110 deg (1 deg lat ~= 111 km)
 *   dLon = +/-0.149 deg (1 deg lon ~= 82.3 km at this latitude)
 */
export const bbox = {
  south: 42.231,
  west: -71.233,
  north: 42.451,
  east: -70.935,
} as const;

/** Map center used for sun position and the local equirectangular projection. */
export const center = {
  lat: 42.3410,
  lon: -71.0840,
} as const;

/** Earth radius in metres (for the equirectangular projection). */
export const earthRadiusM = 6_371_000;

// ---------------------------------------------------------------------------
// Walking kinematics
// ---------------------------------------------------------------------------

/** Base walking speed v in m/s (~5 km/h). */
export const walkSpeedMps = 1.4;

/** Step-edge time multiplier (stairs are slower per metre). */
export const stepMultiplier = 1.6;

// ---------------------------------------------------------------------------
// Exposure leaky integrator (R4)
// ---------------------------------------------------------------------------

/** tau — leaky-integrator time constant, seconds. */
export const tau = 900;

/** Exposure bands b1, b2: A < b1 => low, b1..b2 => elevated, >= b2 => high. */
export const bands = {
  b1: 0.33,
  b2: 0.66,
} as const;

// ---------------------------------------------------------------------------
// Environment / heat model (R3)
// ---------------------------------------------------------------------------

/** k0 — base (fully shaded) fraction of radiative heat retained. */
export const k0 = 0.25;

/** alpha — how strongly shade attenuates the solar term (0..1). */
export const alpha = 0.9;

/** Shade-blend weights a1..a3 for canopy, park, building contributions. */
export const shadeWeights = {
  a1: 0.6, // canopy (trees)
  a2: 0.25, // park openness
  a3: 0.5, // building shade scale (grows at low sun)
} as const;

/** Feature normalisers: n_t trees-per-edge saturation, n_b buildings saturation. */
export const featureNorm = {
  n_t: 8,
  n_b: 6,
} as const;

/** Q_max — max shortwave radiation (W/m^2) used to clamp live radiation to I in [0,1]. */
export const Q_max = 1000;

/** Apparent-temperature clamp range for thermal load theta. */
export const T_lo = 20; // deg C: theta = 0 at or below
export const T_hi = 45; // deg C: theta = 1 at or above

/** sigma_max — maximum per-edge shade, used for H_min admissible bound. */
export const sigmaMax = 0.95;

// ---------------------------------------------------------------------------
// Edge cost weights per mode (R5, R6)
//   each mode differs only in (w_t, w_h, w_s, rho)
//   w_t: time weight, w_h: personal-heat weight, w_s: safety weight,
//   rho: detour cap multiplier on the fastest route time.
// ---------------------------------------------------------------------------

export type Mode = "fastest" | "balanced" | "coolest";

export const modeWeights: Record<Mode, { w_t: number; w_h: number; w_s: number; rho: number }> = {
  fastest: { w_t: 1.0, w_h: 0.0, w_s: 1.0, rho: 1.0 },
  balanced: { w_t: 1.0, w_h: 1.0, w_s: 1.0, rho: 1.3 },
  coolest: { w_t: 1.0, w_h: 3.0, w_s: 1.0, rho: 1.6 },
};

// ---------------------------------------------------------------------------
// Personal factor (R5, R10)
// ---------------------------------------------------------------------------

/** pf = 1 + c_A*A0 + c_HR*clamp((HR-HRbase)/HRbase) ... bounded by pf_max. */
export const personalFactor = {
  c_A: 1.0, // weight on accumulated exposure A0
  c_HR: 0.5, // weight on heart-rate overshoot
} as const;

/** pf_max — hard cap on the personal factor after body uplift. */
export const pf_max = 4.0;

/** gamma — body-temperature uplift slope. */
export const gamma = 1.0;

/** m — margin on (Tc_obs - Tc_model) before an offer is triggered, deg C. */
export const m = 0.3;

// ---------------------------------------------------------------------------
// Turns (R6.7)
// ---------------------------------------------------------------------------

/** Turn instruction thresholds, degrees of bearing change. */
export const turns = {
  /** below this absolute change at a junction = "straight". */
  straightDeg: 25,
  /** straightDeg..sharpDeg = "slight"; at/above sharpDeg = full left/right. */
  sharpDeg: 60,
} as const;

// ---------------------------------------------------------------------------
// Frontier / dedupe (R6)
// ---------------------------------------------------------------------------

/** o_max — max edge-length overlap fraction before two routes are deduped. */
export const o_max = 0.7;

/** delta_A — required drop in arrival exposure before a via-stop is offered. */
export const delta_A = 0.08;

// ---------------------------------------------------------------------------
// Safety field (R7)
// ---------------------------------------------------------------------------

/** Thresholds T1, T2 and hysteresis for safety-driven decisions. */
export const safety = {
  /** S_hard — edges at or above this are hard-masked (infinite cost). */
  S_hard: 0.8,
} as const;

// ---------------------------------------------------------------------------
// Rerouting / offers (R8)
// ---------------------------------------------------------------------------

/** eps — hysteresis: offer only when J_new < (1 - eps) * J_current. */
export const eps = 0.1;

/** SNOOZE_MIN — snooze duration per offer kind, minutes. */
export const SNOOZE_MIN = 5;

/** REARM_DELTA — snoozed->countdown only after tcUsed rises by this, deg C. */
export const REARM_DELTA = 0.3;

// ---------------------------------------------------------------------------
// Escalation reducer (R10)
// ---------------------------------------------------------------------------

/** Core-temperature escalation thresholds and hysteresis, deg C. */
export const escalation = {
  T1: 38.0, // normal -> caution
  T2: 39.0, // caution -> countdown
  hysteresis: 0.3, // step down below T1 - hysteresis
  /** Countdown length (also the frontend's local completion window), seconds. */
  countdownSec: 60,
} as const;

// ---------------------------------------------------------------------------
// Body estimate (R10)
// ---------------------------------------------------------------------------

/** Tc_model = Tc0 + k_A*A + k_HR*clamp((HR-HRbase)/HRbase, 0, 1); range +/- r. */
export const body = {
  Tc0: 37.0, // baseline core temperature, deg C
  k_A: 1.5, // exposure coefficient
  k_HR: 0.8, // heart-rate coefficient
  r: 0.4, // reported range +/- , deg C
  HR_base: 70, // baseline heart rate, bpm
} as const;

// ---------------------------------------------------------------------------
// Event sizes / UI hooks exposed via config (R13.3)
// ---------------------------------------------------------------------------

/** Number of safety zones and ramp steps the Lab can drop / use. */
export const eventSizes = {
  maxZones: 12,
  rampSteps: 5,
} as const;

// ---------------------------------------------------------------------------
// Coverage / departure (R12)
// ---------------------------------------------------------------------------

export const coverage = {
  within5Min: 5,
  within10Min: 10,
  suggestK: 3,
} as const;

export const departure = {
  /** stepMin — sampling increment across the day, minutes. */
  stepMin: 30,
} as const;

// ---------------------------------------------------------------------------
// Performance / caching (R15)
// ---------------------------------------------------------------------------

/** LRU size for plan results and backward trees. */
export const lruSize = 64;

// ---------------------------------------------------------------------------
// Snapshot build / geometry (R2)
// ---------------------------------------------------------------------------

/** Grid-hash cell size in metres (also used for snap and proximity queries). */
export const gridCellM = 25;

/** Edge sampling step in metres when baking static features. */
export const sampleStepM = 10;

/** Proximity radii (metres) for baking per-edge static features. */
export const featureRadii = {
  treeM: 20,
  buildingM: 30,
} as const;

// ---------------------------------------------------------------------------
// Determinism (R14, R6.8)
// ---------------------------------------------------------------------------

/** seed — mulberry32 seed used by the build script's seeded randomness. */
export const seed = 1_337;

// ---------------------------------------------------------------------------
// Data sources for the build script (R2)
// ---------------------------------------------------------------------------

export const dataSources = {
  overpassPrimary: "https://overpass-api.de/api/interpreter",
  overpassMirror: "https://overpass.kumi.systems/api/interpreter",
  /** Boston cooling-center GIS FeatureServer query URL (City of Boston open GIS). */
  coolingCentersUrl:
    "https://gis.boston.gov/arcgis/rest/services/StoryMaps/CoolingCenters/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson",
  /** Open-Meteo endpoint for optional live weather (backend-owned, R3.8). */
  openMeteo: "https://api.open-meteo.com/v1/forecast",
} as const;

// ---------------------------------------------------------------------------
// Snapshot build: tiling + validation gate (R2)
// ---------------------------------------------------------------------------

export const build = {
  /**
   * The bbox is split into a tiles x tiles grid; each tile is fetched from
   * Overpass separately and stitched (a single call for 600 km^2 times out).
   */
  tiles: 4,
  /** Per-tile Overpass retry attempts before failing the build. */
  tileRetries: 3,
  /** Backoff base (ms) between tile retries; multiplied by attempt number. */
  tileBackoffMs: 5000,
  /**
   * Validation gate: the build fails loudly (and does NOT publish) if counts
   * fall outside these sane bounds for the inner-metro bbox. These guard against
   * Overpass silent-partial-success (a 200 with truncated data).
   */
  validate: {
    minNodes: 150_000,
    minEdges: 180_000,
    minTreeFeatures: 5_000,
    minParkFeatures: 50,
    /** Largest connected component must cover at least this fraction of nodes. */
    minConnectedFraction: 0.8,
  },
} as const;

// ---------------------------------------------------------------------------
// Snapshot storage: Cloudflare R2 (S3-compatible). Credentials come from the
// environment (.env, gitignored) — never hardcoded. (R2 as in Cloudflare R2;
// unrelated to requirement R2.)
// ---------------------------------------------------------------------------

export const storage = {
  provider: "r2" as const,
  /** S3-compatible endpoint, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint: process.env.R2_ENDPOINT ?? "",
  /** R2 is region-agnostic via the S3 SDK; "auto" is the convention. */
  region: "auto",
  bucket: process.env.R2_BUCKET ?? "oasyn-maps-graph",
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  /** Key prefix for versioned snapshots: snapshots/inner-metro/<version>/... */
  snapshotPrefix: "snapshots/inner-metro",
  /** Pointer object naming the current good snapshot version. */
  latestPointer: process.env.R2_LATEST_POINTER ?? "snapshots/inner-metro/latest.json",
} as const;

// ---------------------------------------------------------------------------
// Public config slice (R13.3) — exactly what /api/config returns.
// Only values the frontend legitimately needs to display or threshold on.
// ---------------------------------------------------------------------------

export const publicConfig = {
  center,
  bbox,
  walkSpeedMps,
  bands,
  modeWeights,
  pf_max,
  safety: { S_hard: safety.S_hard },
  eps,
  SNOOZE_MIN,
  escalation: {
    T1: escalation.T1,
    T2: escalation.T2,
    hysteresis: escalation.hysteresis,
    countdownSec: escalation.countdownSec,
  },
  body: { Tc0: body.Tc0, r: body.r, HR_base: body.HR_base },
  eventSizes,
  coverage,
  departure,
  T_lo,
  T_hi,
} as const;

export type PublicConfig = typeof publicConfig;
