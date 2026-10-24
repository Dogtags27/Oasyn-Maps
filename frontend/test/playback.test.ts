/**
 * playback.test.ts — the walker interpolates A from aTrace and position from
 * geometry; it never recomputes exposure (R7.2).
 */
import { describe, it, expect } from "vitest";
import { exposureAt, progressAt, positionAt } from "@/lab/playback";
import type { RouteResultT } from "@/api/types";

const route: RouteResultT = {
  id: "r1",
  mode: "balanced",
  geometry: [
    { lat: 0, lng: 0 },
    { lat: 10, lng: 0 },
    { lat: 10, lng: 10 },
  ],
  timeSec: 100,
  distanceM: 1000,
  heatMinutes: 5,
  shadePct: 50,
  arrivalBand: "low",
  safetyMax: 0.1,
  oases: [],
  j: 0.5,
  feasible: true,
  turns: [],
  aTrace: [
    [0, 0, 0.2],
    [50, 500, 0.4],
    [100, 1000, 0.8],
  ],
  explanations: [],
};

describe("exposureAt", () => {
  it("returns the first sample before the start", () => {
    expect(exposureAt(route, -10)).toBe(0.2);
  });
  it("interpolates linearly between samples", () => {
    // Midway between t=0 (0.2) and t=50 (0.4) -> 0.3
    expect(exposureAt(route, 25)).toBeCloseTo(0.3, 5);
  });
  it("clamps to the last sample after the end", () => {
    expect(exposureAt(route, 200)).toBe(0.8);
  });
});

describe("progressAt", () => {
  it("is 0 at the start and 1 at the end", () => {
    expect(progressAt(route, 0)).toBe(0);
    expect(progressAt(route, 100)).toBe(1);
    expect(progressAt(route, 50)).toBeCloseTo(0.5, 5);
  });
});

describe("positionAt", () => {
  it("returns the first vertex at progress 0", () => {
    expect(positionAt(route, 0)).toEqual({ lat: 0, lng: 0 });
  });
  it("interpolates along the geometry at the midpoint", () => {
    // Two segments; progress 0.5 lands at the shared middle vertex.
    expect(positionAt(route, 0.5)).toEqual({ lat: 10, lng: 0 });
  });
  it("returns the last vertex at progress 1", () => {
    expect(positionAt(route, 1)).toEqual({ lat: 10, lng: 10 });
  });
});
