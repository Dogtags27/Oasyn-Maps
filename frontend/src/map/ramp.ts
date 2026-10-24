/**
 * map/ramp.ts — the exposure ramp (R4.3, R16.4).
 *
 * Segment colour comes from the config bands (b1/b2), mapped to the
 * necklace -> amber -> brick token ramp. Colour is NEVER the sole signal: high-
 * heat segments also get a redundant paper tick pattern (drawn in RouteLayer)
 * and the legend carries text labels. The thresholds are read from config, not
 * hardcoded.
 */
import type { Bands } from "@/config";
import { bandForExposure } from "@/config";

export type RampBand = "low" | "elevated" | "high";

/** CSS token variable for a band. */
export function bandColorVar(band: RampBand): string {
  switch (band) {
    case "low":
      return "var(--ramp-low)";
    case "elevated":
      return "var(--ramp-elevated)";
    case "high":
      return "var(--ramp-high)";
  }
}

/**
 * Resolve a token variable to its computed colour (Leaflet needs a real value,
 * not a CSS var reference). The fallback is the `currentColor` keyword so no
 * colour literal exists outside the token set: in a non-browser context (tests)
 * the value simply inherits ink rather than naming a hex.
 */
export function resolveVar(cssVar: string): string {
  const fallback = "currentColor";
  if (typeof getComputedStyle === "undefined") return fallback;
  const name = cssVar.replace(/^var\(/, "").replace(/\)$/, "").trim();
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Band for an exposure value using config bands. */
export function rampBand(a: number, bands: Bands): RampBand {
  return bandForExposure(a, bands);
}

/** True when a segment should carry the redundant high-heat tick pattern. */
export function isHighHeat(a: number, bands: Bands): boolean {
  return rampBand(a, bands) === "high";
}
