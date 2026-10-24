/**
 * cache.ts — a tiny bounded LRU (R15.1, R15.2).
 *
 * Statelessness (R14.4): this is an in-process performance cache only. It holds
 * no user identity, persists nothing across process restarts, and stores no raw
 * coordinates as keys (keys are opaque hashes from hash.ts). Entries are evicted
 * by least-recent-use when the bound is exceeded.
 */

import { lruSize } from "./config.js";

export class LRU<V> {
  private map = new Map<string, V>();
  constructor(private readonly max: number = lruSize) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // Refresh recency: delete + re-insert moves it to the end.
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) {
      // Oldest = first key in insertion order.
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
