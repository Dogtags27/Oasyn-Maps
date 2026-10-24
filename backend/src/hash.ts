/**
 * hash.ts — stable, deterministic hashing of request keys (R15.1, R15.2).
 *
 * Used to key the LRU caches for plan results (hash(scenario, start, goal, mode))
 * and backward trees (hash(scenario, goal)). Must be stable across requests and
 * must NOT include coordinates or identifiers in any logged form (R14.4) — the
 * hash is an opaque digest, never reversed or logged with raw inputs.
 *
 * FNV-1a over a canonical JSON serialisation (sorted keys) — fast, dependency-free,
 * and collision-resistant enough for an in-process LRU.
 */

/** Canonical JSON with sorted object keys so equal inputs hash identically. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

/** FNV-1a 32-bit over a string, returned as 8-hex. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Stable hash of an arbitrary set of key parts. */
export function hashKey(...parts: unknown[]): string {
  return fnv1a(canonical(parts));
}
