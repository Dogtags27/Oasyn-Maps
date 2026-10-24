/**
 * map/rng.ts — a small seeded PRNG (mulberry32) for ART ONLY (R4.4).
 *
 * Used to give tree glyphs a stable, seeded rotation keyed by node id so the map
 * looks hand-drawn without being random on every render. This never touches any
 * domain value — purely cosmetic.
 */
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

/** Hash a string id into a 32-bit seed. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable rotation in degrees for a node id, keyed for art. */
export function seededRotation(id: string): number {
  return Math.floor(mulberry32(hashId(id))() * 360);
}
