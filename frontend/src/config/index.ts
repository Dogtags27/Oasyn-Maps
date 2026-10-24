/**
 * config/ — typed accessors over the cached /api/config (R2.6, R1.4).
 *
 * The frontend holds NO thresholds. Every band, ramp step, cap, speed, event
 * size, and countdown length is read from the backend config through these
 * accessors. Components call `useConfigValues()` and read named fields; they
 * never write a numeric literal for a model value.
 *
 * The shape is intentionally permissive (ConfigResponse is z.record(any)); these
 * accessors narrow it with safe fallbacks so a missing field never crashes the
 * UI, while keeping the backend authoritative when present.
 */
import type { ConfigResponseT } from "@/api/types";

export interface Bands {
  /** low -> elevated boundary, on the 0..1 exposure scale. */
  b1: number;
  /** elevated -> high boundary. */
  b2: number;
}

export interface Escalation {
  T1: number;
  T2: number;
  hysteresis: number;
  countdownSec: number;
}

export interface ConfigView {
  center: { lat: number; lon: number };
  bbox: { south: number; west: number; north: number; east: number };
  walkSpeedMps: number;
  bands: Bands;
  escalation: Escalation;
  snoozeMin: number;
  maxZones: number;
  rampSteps: number;
  within5Min: number;
  within10Min: number;
  suggestK: number;
  departureStepMin: number;
  tempLo: number;
  tempHi: number;
  /** Debounce interval for slider-driven requests, ms. */
  debounceMs: number;
  /** Playback speed multipliers offered in the Lab. */
  playbackSpeeds: number[];
  /** The raw config, for any field not yet surfaced above. */
  raw: ConfigResponseT;
}

function num(raw: Record<string, unknown>, path: string[], fallback: number): number {
  let cur: unknown = raw;
  for (const key of path) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return fallback;
    }
  }
  return typeof cur === "number" ? cur : fallback;
}

/** Narrow the permissive config into a typed view with safe fallbacks. */
export function viewConfig(raw: ConfigResponseT | null): ConfigView {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    center: {
      lat: num(r, ["center", "lat"], 42.341),
      lon: num(r, ["center", "lon"], -71.084),
    },
    bbox: {
      south: num(r, ["bbox", "south"], 42.33),
      west: num(r, ["bbox", "west"], -71.095),
      north: num(r, ["bbox", "north"], 42.352),
      east: num(r, ["bbox", "east"], -71.073),
    },
    walkSpeedMps: num(r, ["walkSpeedMps"], 1.4),
    bands: {
      b1: num(r, ["bands", "b1"], 0.33),
      b2: num(r, ["bands", "b2"], 0.66),
    },
    escalation: {
      T1: num(r, ["escalation", "T1"], 38),
      T2: num(r, ["escalation", "T2"], 39),
      hysteresis: num(r, ["escalation", "hysteresis"], 0.3),
      countdownSec: num(r, ["escalation", "countdownSec"], 60),
    },
    snoozeMin: num(r, ["SNOOZE_MIN"], 5),
    maxZones: num(r, ["eventSizes", "maxZones"], 12),
    rampSteps: num(r, ["eventSizes", "rampSteps"], 5),
    within5Min: num(r, ["coverage", "within5Min"], 5),
    within10Min: num(r, ["coverage", "within10Min"], 10),
    suggestK: num(r, ["coverage", "suggestK"], 3),
    departureStepMin: num(r, ["departure", "stepMin"], 30),
    tempLo: num(r, ["T_lo"], 20),
    tempHi: num(r, ["T_hi"], 45),
    debounceMs: num(r, ["debounceMs"], 250),
    playbackSpeeds: Array.isArray((r as { playbackSpeeds?: unknown }).playbackSpeeds)
      ? ((r as { playbackSpeeds: unknown[] }).playbackSpeeds.filter(
          (n): n is number => typeof n === "number",
        ) as number[])
      : [30, 60, 120],
    raw: (raw ?? {}) as ConfigResponseT,
  };
}

/** Classify a 0..1 exposure value into an ExposureBand using config bands. */
export function bandForExposure(a: number, bands: Bands): "low" | "elevated" | "high" {
  if (a < bands.b1) return "low";
  if (a < bands.b2) return "elevated";
  return "high";
}
