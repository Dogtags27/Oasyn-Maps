/**
 * rng.ts — mulberry32 seeded PRNG (design §9). Deterministic: identical seed
 * yields an identical stream. Used for seeded build-time randomness and tests;
 * never used inside request handling in core/ (determinism principle).
 */

import { seed as configSeed } from "./config.js";

/** Returns a function yielding floats in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Default seeded stream from config. */
export function defaultRng(): () => number {
  return mulberry32(configSeed);
}
