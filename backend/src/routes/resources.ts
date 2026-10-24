/**
 * routes/resources.ts — load cooling/water resources and snap them to graph
 * nodes once, for the via-stop guard (R9). Fetched from the same source as the
 * snapshot (R2/local) and cached; the routing hot path never re-reads them.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Snapshot } from "../snapshot.js";
import type { GraphView } from "../core/graph.js";
import type { Resource } from "../core/cooling.js";
import { r2Client, r2Env, getObject } from "../../scripts/lib/r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const localDataDir = join(here, "..", "..", "data");

/** Default cooling dwell (seconds) when a resource is used as a via-stop. */
const DWELL_SEC = 300;

let cached: Resource[] | null = null;

async function readLayer(snap: Snapshot, name: string): Promise<unknown[]> {
  let raw: Buffer;
  if (snap.source.kind === "r2" && snap.source.prefix) {
    const env = r2Env();
    raw = await getObject(r2Client(env), env.bucket, `${snap.source.prefix}/${name}.json`);
  } else {
    const path = join(localDataDir, `${name}.json`);
    if (!existsSync(path)) return [];
    raw = readFileSync(path);
  }
  return (JSON.parse(raw.toString("utf8")) as { features?: unknown[] }).features ?? [];
}

/** Load cooling + water resources, snapped to nodes. Cached after first call. */
export async function loadResources(snap: Snapshot, graph: GraphView): Promise<Resource[]> {
  if (cached) return cached;
  const out: Resource[] = [];
  for (const layer of ["cooling", "water"]) {
    const features = await readLayer(snap, layer).catch(() => []);
    for (const f of features as Array<{ geometry?: { coordinates?: [number, number] }; properties?: { name?: string } }>) {
      const c = f.geometry?.coordinates;
      if (!c) continue;
      const [lon, lat] = c;
      const node = graph.snapNode(lat, lon);
      if (node < 0) continue;
      out.push({
        node,
        name: f.properties?.name ?? (layer === "cooling" ? "Sample Cooling Center" : "Sample Fountain"),
        dwellSec: DWELL_SEC,
        dwellHeat: 0,
      });
    }
  }
  cached = out;
  return out;
}
