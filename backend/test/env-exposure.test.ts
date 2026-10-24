/**
 * env-exposure.test.ts — environment and exposure properties (R17.1).
 *   env:      H in [0,1]; dH/dI >= 0; dH/dsigma <= 0
 *   exposure: closed form matches analytic; A bounded; decays to 0 when H = 0
 */

import { describe, it, expect } from "vitest";
import { edgeHeat, edgeShade, solarIntensity, thermalLoad } from "../src/core/env.js";
import { stepA, arrivalExposure, band } from "../src/core/exposure.js";
import { tau, bands } from "../src/config.js";

describe("heat rate H (R3, R17.1)", () => {
  it("H stays in [0,1] across the input grid", () => {
    for (let theta = 0; theta <= 1; theta += 0.25) {
      for (let I = 0; I <= 1; I += 0.25) {
        for (let sigma = 0; sigma <= 1; sigma += 0.25) {
          const H = edgeHeat(theta, I, sigma);
          expect(H).toBeGreaterThanOrEqual(0);
          expect(H).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("H is monotone non-decreasing in I", () => {
    const theta = 0.8;
    const sigma = 0.3;
    let prev = -1;
    for (let I = 0; I <= 1; I += 0.1) {
      const H = edgeHeat(theta, I, sigma);
      expect(H).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = H;
    }
  });

  it("H is monotone non-increasing in sigma (shade)", () => {
    const theta = 0.8;
    const I = 0.9;
    let prev = Infinity;
    for (let sigma = 0; sigma <= 1; sigma += 0.1) {
      const H = edgeHeat(theta, I, sigma);
      expect(H).toBeLessThanOrEqual(prev + 1e-9);
      prev = H;
    }
  });

  it("solar intensity and thermal load are clamped to [0,1]", () => {
    expect(solarIntensity(0)).toBeLessThanOrEqual(1);
    expect(solarIntensity(1)).toBeGreaterThanOrEqual(0);
    expect(thermalLoad(-100)).toBe(0);
    expect(thermalLoad(1000)).toBe(1);
  });

  it("more shade from trees reduces exposure to heat", () => {
    const bare = edgeShade(0, 0, 0, 1);
    const treed = edgeShade(8, 0, 0, 1);
    expect(treed).toBeGreaterThan(bare);
  });
});

describe("leaky integrator (R4, R17.1)", () => {
  it("stepA matches the analytic closed form", () => {
    const A = 0.2;
    const H = 0.7;
    const dt = 300;
    const expected = A * Math.exp(-dt / tau) + H * (1 - Math.exp(-dt / tau));
    expect(stepA(A, H, dt)).toBeCloseTo(expected, 12);
  });

  it("A stays bounded by the max heat rate along the path", () => {
    const H = 0.6;
    const dts = Array(50).fill(120);
    const hs = Array(50).fill(H);
    const A = arrivalExposure(0, dts, hs);
    expect(A).toBeLessThanOrEqual(H + 1e-9);
    // and approaches H for a long exposure
    expect(A).toBeGreaterThan(0.5);
  });

  it("A decays toward 0 when H = 0", () => {
    const start = 0.9;
    const A = stepA(start, 0, 10 * tau);
    expect(A).toBeLessThan(0.0001);
  });

  it("band thresholds follow config", () => {
    expect(band(bands.b1 - 0.01)).toBe("low");
    expect(band(bands.b1 + 0.01)).toBe("elevated");
    expect(band(bands.b2 + 0.01)).toBe("high");
  });
});
