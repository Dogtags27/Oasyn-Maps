/**
 * ramp.test.ts — the exposure ramp reads bands from config, not literals (R4.3).
 */
import { describe, it, expect } from "vitest";
import { rampBand, isHighHeat } from "@/map/ramp";
import { bandForExposure } from "@/config";

const bands = { b1: 0.33, b2: 0.66 };

describe("ramp bands", () => {
  it("classifies below b1 as low", () => {
    expect(rampBand(0.2, bands)).toBe("low");
    expect(bandForExposure(0.2, bands)).toBe("low");
  });

  it("classifies between b1 and b2 as elevated", () => {
    expect(rampBand(0.5, bands)).toBe("elevated");
  });

  it("classifies at/above b2 as high and flags the tick", () => {
    expect(rampBand(0.8, bands)).toBe("high");
    expect(isHighHeat(0.8, bands)).toBe(true);
    expect(isHighHeat(0.5, bands)).toBe(false);
  });

  it("respects different config bands (no hardcoded thresholds)", () => {
    const shifted = { b1: 0.5, b2: 0.9 };
    expect(rampBand(0.4, shifted)).toBe("low");
    expect(rampBand(0.6, shifted)).toBe("elevated");
    expect(rampBand(0.95, shifted)).toBe("high");
  });
});
