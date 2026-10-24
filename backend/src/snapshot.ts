/**
 * snapshot.ts — load the graph snapshot into CSR typed arrays at server start
 * (R1.1, R15.3). Fetches the binary snapshot from Cloudflare R2 (design §8.4),
 * decodes it with zero-copy typed-array views, and allocates the runtime
 * `heat`/`safety` arrays once. Fails fast on any load error (§13).
 *
 * The binary format is the single source of truth shared with the build script
 * (scripts/lib/snapshot-format.mjs). We load binary — not JSON — because the
 * inner-metro graph is ~170 MB as JSON and parsing it at boot is seconds of CPU;
 * the binary loads as views over the downloaded buffer in milliseconds.
 */

import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import {
  decodeSnapshot,
  type DecodedSnapshot,
} from "../scripts/lib/snapshot-format.mjs";
import { decodeHorizon } from "../scripts/lib/horizon-format.mjs";
import { r2Client, r2Env, getObject, getJson } from "../scripts/lib/r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const localDataDir = join(here, "..", "data");

/** How the snapshot was loaded, so sibling layer files can be fetched the same way. */
export interface SnapshotSource {
  kind: "r2" | "local";
  /** R2 object-key prefix for this snapshot version (when kind === "r2"). */
  prefix?: string;
}

/** Loaded snapshot: immutable static CSR arrays + mutable per-scenario runtime arrays. */
export interface Snapshot {
  V: number;
  E: number;
  center: { lat: number; lon: number };
  // Static CSR (views over the decoded buffer).
  offsets: Int32Array;
  targets: Int32Array;
  edgeOf: Int32Array;
  len: Float32Array;
  trees: Float32Array;
  park: Float32Array;
  bldg: Float32Array;
  step: Uint8Array;
  nodeLat: Float32Array;
  nodeLon: Float32Array;
  nodeX: Float32Array;
  nodeY: Float32Array;
  /**
   * Baked per-edge skyline (horizon.bin), if the snapshot has one. Absent on
   * older snapshots and hand-built test graphs; the engine then falls back to
   * the building-proximity count.
   */
  horizon?: SnapshotHorizon;
  // Runtime, recomputed per scenario (R15.3); allocated once here.
  heat: Float32Array;
  safety: Float32Array;
  // Provenance from meta.json.
  meta: SnapshotMeta;
  // Where this snapshot came from, so layer files can be fetched the same way.
  source: SnapshotSource;
}

/** Skyline elevation per edge and compass bin; see scripts/lib/horizon-format.mjs. */
export interface SnapshotHorizon {
  /** compass bins; bin k looks along bearing k * 360 / bins (0 = north, clockwise). */
  bins: number;
  /** degrees per stored unit. */
  quantDeg: number;
  /** edge-major, E * bins entries. */
  data: Uint8Array;
}

export interface SnapshotMeta {
  version: string;
  nodes: number;
  edges: number;
  rawNodes?: number;
  rawEdges?: number;
  connectedFraction?: number;
  center?: { lat: number; lon: number };
  layers: unknown[];
}

/** Decode horizon.bin bytes; returns undefined (with a warning) if it does not fit this graph. */
function parseHorizon(buf: Buffer | undefined, E: number): SnapshotHorizon | undefined {
  if (!buf) return undefined;
  try {
    const hz = decodeHorizon(buf);
    if (hz.E !== E) {
      console.warn(`snapshot: horizon.bin has ${hz.E} edges but graph has ${E}; ignoring skyline`);
      return undefined;
    }
    return { bins: hz.bins, quantDeg: hz.quantDeg, data: hz.data };
  } catch (err) {
    console.warn(`snapshot: horizon.bin unusable (${(err as Error).message}); ignoring skyline`);
    return undefined;
  }
}

function fromDecoded(
  dec: DecodedSnapshot,
  meta: SnapshotMeta,
  source: SnapshotSource,
  horizon?: SnapshotHorizon,
): Snapshot {
  return {
    V: dec.V,
    E: dec.E,
    center: dec.projection.center,
    offsets: dec.arrays.offsets,
    targets: dec.arrays.targets,
    edgeOf: dec.arrays.edgeOf,
    len: dec.arrays.len,
    trees: dec.arrays.trees,
    park: dec.arrays.park,
    bldg: dec.arrays.bldg,
    step: dec.arrays.step,
    nodeLat: dec.arrays.nodeLat,
    nodeLon: dec.arrays.nodeLon,
    nodeX: dec.arrays.nodeX,
    nodeY: dec.arrays.nodeY,
    horizon,
    heat: new Float32Array(dec.E),
    safety: new Float32Array(dec.E),
    meta,
    source,
  };
}

/**
 * Load from R2: read the `latest` pointer, download `graph.bin` + `meta.json`,
 * decode. This is the production path.
 */
async function loadFromR2(): Promise<Snapshot> {
  const env = r2Env();
  const client = r2Client(env);
  const pointer = (await getJson(client, env.bucket, env.latestPointer)) as {
    prefix: string;
    meta: SnapshotMeta;
  };
  const bin = await getObject(client, env.bucket, `${pointer.prefix}/graph.bin`);
  const dec = decodeSnapshot(bin);
  if (dec.E !== pointer.meta.edges || dec.V !== pointer.meta.nodes) {
    throw new Error(
      `snapshot: decoded V/E (${dec.V}/${dec.E}) disagree with pointer meta (${pointer.meta.nodes}/${pointer.meta.edges})`,
    );
  }
  // Optional skyline: older snapshot versions simply do not have the object.
  let hzBuf: Buffer | undefined;
  try {
    hzBuf = await getObject(client, env.bucket, `${pointer.prefix}/horizon.bin`);
  } catch {
    hzBuf = undefined;
  }
  return fromDecoded(dec, pointer.meta, { kind: "r2", prefix: pointer.prefix }, parseHorizon(hzBuf, dec.E));
}

/** Load from a locally-built snapshot (data/graph.bin). Dev fallback. */
function loadFromLocal(): Snapshot {
  const binPath = join(localDataDir, "graph.bin");
  const metaPath = join(localDataDir, "meta.json");
  if (!existsSync(binPath)) {
    throw new Error(`snapshot: local ${binPath} not found`);
  }
  const bin = readFileSync(binPath);
  const dec = decodeSnapshot(bin);
  const meta = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, "utf8")) as SnapshotMeta)
    : ({ version: "local", nodes: dec.V, edges: dec.E, layers: [] } as SnapshotMeta);
  const hzPath = join(localDataDir, "horizon.bin");
  const hzBuf = existsSync(hzPath) ? readFileSync(hzPath) : undefined;
  return fromDecoded(dec, meta, { kind: "local" }, parseHorizon(hzBuf, dec.E));
}

/**
 * Load the snapshot, failing fast on error (R1 / §13).
 *
 * Source precedence:
 *   - SNAPSHOT_SOURCE=local  -> data/graph.bin
 *   - SNAPSHOT_SOURCE=r2     -> R2 (default when R2 env is configured)
 *   - otherwise auto: R2 if credentials present, else local.
 */
export async function loadSnapshot(): Promise<Snapshot> {
  loadEnv({ path: join(here, "..", ".env") });
  const source = process.env.SNAPSHOT_SOURCE;
  const r2Configured = !!process.env.R2_ENDPOINT && !!process.env.R2_ACCESS_KEY_ID;

  if (source === "local") return loadFromLocal();
  if (source === "r2" || (!source && r2Configured)) {
    return loadFromR2();
  }
  return loadFromLocal();
}
