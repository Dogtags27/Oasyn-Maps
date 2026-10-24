/**
 * routes/search.ts — GET /api/search: start / destination lookup.
 *
 * Two sources, merged and de-duplicated:
 *   1. LOCAL — named features already in the snapshot layers (OSM places and
 *      parks, City of Boston cooling centres, named fountains). Always
 *      available, no third party involved.
 *   2. GEOCODER — an OSM geocoder (Photon) for street addresses and points of
 *      interest, hard-limited to the snapshot bbox so every result is routable.
 *      Called server-side (the user's IP never reaches it), cached, throttled,
 *      and time-boxed: on any failure we return local matches with
 *      `degraded: true` instead of an error.
 *
 * Statelessness (R14.4): queries are never logged; the cache key is the
 * normalised query text only.
 */

import type { Request, Response } from "express";
import {
  SearchRequest,
  SearchResponse,
  type SearchKind,
  type SearchResult,
} from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import { bbox, search as cfg } from "../config.js";
import { LRU } from "../cache.js";
import { loadLayerFeatures } from "./layers.js";
import { campuses } from "./campuses.js";
import { zodToApiError, sendError } from "./error.js";

const isDev = process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Text normalisation and scoring
// ---------------------------------------------------------------------------

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Score a candidate name against a normalised query. 0 = no match.
 * exact > prefix > word-prefix > all-tokens > substring.
 */
export function scoreName(nameNorm: string, q: string): number {
  if (!nameNorm || !q) return 0;
  if (nameNorm === q) return 100;
  if (nameNorm.startsWith(q)) return 80;
  const words = nameNorm.split(" ");
  if (words.some((w) => w.startsWith(q))) return 65;
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => words.some((w) => w.startsWith(t)))) return 55;
  if (nameNorm.includes(q)) return 40;
  return 0;
}

/** Curated campuses outrank everything local: they are what people mean. */
const CAMPUS_BOOST = 8;

const KIND_BOOST: Record<SearchKind, number> = {
  cooling: 4,
  place: 3,
  park: 2,
  water: 1,
  poi: 0,
  address: 0,
};

/** Metres between two lat/lng points (equirectangular; fine at city scale). */
function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const kx = 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dx = (a.lng - b.lng) * kx;
  const dy = (a.lat - b.lat) * 110_540;
  return Math.hypot(dx, dy);
}

function inBbox(lat: number, lng: number): boolean {
  return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east;
}

// ---------------------------------------------------------------------------
// Local index (built once from the snapshot layers)
// ---------------------------------------------------------------------------

interface IndexEntry {
  result: SearchResult;
  norm: string;
  /** extra score (curated entries). */
  boost?: number;
  /** abbreviations ("bu", "mit") match only exactly, never as a prefix. */
  exactOnly?: boolean;
}

/** One index entry per campus alias; merge() collapses them by id. */
export function campusEntries(): IndexEntry[] {
  const out: IndexEntry[] = [];
  for (const c of campuses) {
    const result: SearchResult = {
      id: `campus:${c.id}`,
      name: c.name,
      detail: c.detail,
      at: { lat: c.lat, lng: c.lng },
      kind: "poi",
      source: "local",
    };
    const names = new Set([normalise(c.name), ...c.aliases.map(normalise)]);
    for (const norm of names) {
      out.push({ norm, result, boost: CAMPUS_BOOST, exactOnly: norm.length <= 4 });
    }
  }
  return out;
}

type Feature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Representative point of a Point / Polygon / MultiPolygon (vertex average of the outer ring). */
function anchor(geom: Feature["geometry"]): { lat: number; lng: number } | null {
  if (!geom || !geom.coordinates) return null;
  const c = geom.coordinates as unknown;
  let ring: number[][] | undefined;
  if (geom.type === "Point") {
    const [lng, lat] = c as number[];
    return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
  }
  if (geom.type === "Polygon") ring = (c as number[][][])[0];
  if (geom.type === "MultiPolygon") ring = (c as number[][][][])[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [lng, lat] of ring) {
    sx += lng!;
    sy += lat!;
  }
  return { lat: sy / ring.length, lng: sx / ring.length };
}

async function buildIndex(snap: Snapshot): Promise<IndexEntry[]> {
  const out: IndexEntry[] = campusEntries();
  const add = (
    layer: string,
    kind: SearchKind,
    pick: (p: Record<string, unknown>) => { name?: string; detail?: string; id?: string },
  ) =>
    loadLayerFeatures(snap, layer)
      .then((features) => {
        (features as Feature[]).forEach((f, i) => {
          const p = f.properties ?? {};
          const { name, detail, id } = pick(p);
          if (!name) return;
          const at = anchor(f.geometry);
          if (!at || !inBbox(at.lat, at.lng)) return;
          out.push({
            norm: normalise(name),
            result: {
              id: `${layer}:${id ?? i}`,
              name,
              ...(detail ? { detail } : {}),
              at,
              kind,
              source: "local",
            },
          });
        });
      })
      // A missing layer must not break search; it simply contributes nothing.
      .catch(() => undefined);

  await Promise.all([
    add("places", "place", (p) => ({ name: str(p.name), id: str(p.id) })),
    add("parks", "park", (p) => ({ name: str(p.name), id: str(p.id) })),
    add("cooling", "cooling", (p) => ({
      name: str(p.FullName) ?? str(p.Name) ?? str(p.name),
      detail: str(p.Address),
      id: p.OBJECTID !== undefined ? String(p.OBJECTID) : str(p.id),
    })),
    add("water", "water", (p) => ({ name: str(p.name), id: str(p.id) })),
  ]);
  return out;
}

export function searchLocal(
  index: IndexEntry[],
  q: string,
  limit: number,
): Array<SearchResult & { score: number }> {
  // Best score per result id (a campus has several alias entries).
  const best = new Map<string, SearchResult & { score: number }>();
  for (const e of index) {
    const s = e.exactOnly ? (e.norm === q ? 100 : 0) : scoreName(e.norm, q);
    if (s <= 0) continue;
    const score = s + KIND_BOOST[e.result.kind] + (e.boost ?? 0);
    const prev = best.get(e.result.id);
    if (!prev || score > prev.score) best.set(e.result.id, { ...e.result, score });
  }
  const hits = [...best.values()];
  hits.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  return hits.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Geocoder (Photon)
// ---------------------------------------------------------------------------

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

function photonKind(p: Record<string, unknown>): SearchKind {
  const key = str(p.osm_key);
  const value = str(p.osm_value);
  if (key === "leisure" && (value === "park" || value === "garden")) return "park";
  if (key === "place") return "place";
  if (!str(p.name)) return "address";
  return "poi";
}

/** Map one Photon feature to a SearchResult (null if unusable / outside bbox). */
export function fromPhoton(f: PhotonFeature, i: number): SearchResult | null {
  const p = f.properties ?? {};
  const c = f.geometry?.coordinates;
  if (!c) return null;
  const tag = `${str(p.osm_key) ?? ""}=${str(p.osm_value) ?? ""}`;
  if ((cfg.dropTags as readonly string[]).includes(tag)) return null;
  const [lng, lat] = c;
  if (typeof lat !== "number" || typeof lng !== "number" || !inBbox(lat, lng)) return null;
  const street = [str(p.housenumber), str(p.street)].filter(Boolean).join(" ");
  const name = str(p.name) ?? (street || undefined);
  if (!name) return null;
  const area = str(p.district) ?? str(p.locality) ?? str(p.city);
  const detailParts = [street && street !== name ? street : undefined, area].filter(Boolean);
  const osmType = str(p.osm_type) ?? "x";
  const osmId = p.osm_id !== undefined ? String(p.osm_id) : String(i);
  return {
    id: `osm:${osmType}${osmId}`,
    name,
    ...(detailParts.length ? { detail: detailParts.join(", ") } : {}),
    at: { lat, lng },
    kind: photonKind(p),
    source: "geocoder",
  };
}

const geoCache = new LRU<SearchResult[]>(cfg.cacheSize);
let lastCallAt = 0;
let gate: Promise<void> = Promise.resolve();
/** While Date.now() < this, the geocoder is skipped (it recently refused us). */
let cooldownUntil = 0;

/** Serialise outgoing calls with a minimum gap (fair use across all users). */
function throttle(): Promise<void> {
  const next = gate.then(async () => {
    const wait = lastCallAt + cfg.minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  gate = next.catch(() => undefined);
  return next;
}

async function searchGeocoder(q: string, lang: string, limit: number): Promise<SearchResult[]> {
  const key = `${lang}|${q}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  if (Date.now() < cooldownUntil) throw new Error("geocoder cooling down");

  await throttle();
  const url = new URL(cfg.geocoderUrl);
  url.searchParams.set("q", q);
  // Over-fetch: transit poles/platforms are filtered out after the call.
  url.searchParams.set("limit", String(Math.max(10, limit + 6)));
  url.searchParams.set("lang", lang);
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.geocoderTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": cfg.userAgent, Accept: "application/json" },
    });
    if (!res.ok) {
      // Back off on throttling / outages instead of hammering the operator.
      if (res.status === 429 || res.status >= 500) cooldownUntil = Date.now() + cfg.cooldownMs;
      throw new Error(`geocoder ${res.status}`);
    }
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const results = (body.features ?? [])
      .map((f, i) => fromPhoton(f, i))
      .filter((r): r is SearchResult => r !== null);
    geoCache.set(key, results);
    return results;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/** Local matches first, then geocoder; drop same-name results within dedupeM. */
export function merge(local: SearchResult[], remote: SearchResult[], limit: number): SearchResult[] {
  const out: SearchResult[] = [];
  const seenIds = new Set<string>();
  for (const r of [...local, ...remote]) {
    if (out.length >= limit) break;
    if (seenIds.has(r.id)) continue;
    const n = normalise(r.name);
    const dup = out.some((o) => normalise(o.name) === n && distM(o.at, r.at) < cfg.dedupeM);
    if (dup) continue;
    seenIds.add(r.id);
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/** Factory: GET /api/search bound to the loaded snapshot (if any). */
export function makeSearchRoute(snapshot?: Snapshot) {
  let indexPromise: Promise<IndexEntry[]> | null = null;
  const index = (): Promise<IndexEntry[]> => {
    // No snapshot: curated campuses still work (plus the geocoder).
    if (!snapshot) return Promise.resolve(campusEntries());
    if (!indexPromise) {
      indexPromise = buildIndex(snapshot).catch(() => {
        indexPromise = null; // retry on the next request
        return campusEntries();
      });
    }
    return indexPromise;
  };
  // Warm the index in the background so the first user search is fast.
  void index();

  return async (req: Request, res: Response): Promise<void> => {
    const parsed = SearchRequest.safeParse(req.query);
    if (!parsed.success) {
      const body = zodToApiError(parsed.error);
      res.status(body.status).json(body);
      return;
    }
    try {
      const { q, limit } = parsed.data;
      const qNorm = normalise(q);
      const langBase = (parsed.data.lang ?? "en").toLowerCase().split("-")[0]!;
      const lang = (cfg.geocoderLangs as readonly string[]).includes(langBase) ? langBase : "en";

      // Run both sources in parallel; the geocoder may fail independently.
      const [localHits, remote] = await Promise.all([
        index().then((ix) => searchLocal(ix, qNorm, limit)),
        cfg.geocoderUrl && qNorm.length >= 2
          ? searchGeocoder(q.trim(), lang, limit).then(
              (r) => ({ ok: true as const, r }),
              () => ({ ok: false as const, r: [] as SearchResult[] }),
            )
          : Promise.resolve({ ok: false as const, r: [] as SearchResult[] }),
      ]);

      // Strong local hits (prefix or better) lead; weak substring hits trail
      // the geocoder so "fenway" puts Fenway Park above "West Fenway Garden".
      const strong = localHits.filter((h) => h.score >= 55).map(({ score: _s, ...r }) => r);
      const weak = localHits.filter((h) => h.score < 55).map(({ score: _s, ...r }) => r);
      const results = merge(strong, [...remote.r, ...weak], limit);

      const body = {
        query: q,
        results,
        degraded: Boolean(cfg.geocoderUrl) && !remote.ok,
      };
      const checked = isDev ? SearchResponse.parse(body) : body;
      // Same query -> same answer for a while; lets browsers/CDNs reuse it.
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(checked);
    } catch (err) {
      sendError(res, err);
    }
  };
}
