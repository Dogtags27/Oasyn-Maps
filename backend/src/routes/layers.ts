/**
 * routes/layers.ts — GET /api/layers/:name, live from the snapshot (R2.3, R13.2).
 *
 * Optimized loading: display layers (parks/trees/water/cooling/places) total
 * ~100 MB. Rather than hold them all in memory at boot, each layer is fetched
 * from the SAME source as the graph snapshot (R2 or local) on first request and
 * cached. The routing hot path never touches these; they are display-only.
 *
 * Provenance from the snapshot's meta.json is attached to every response, and
 * the stub header is dropped (these are real now).
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Request, Response } from "express";
import { LayerName, LayerResponse, type Provenance } from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import { r2Client, r2Env, getObject } from "../../scripts/lib/r2.mjs";
import { apiError } from "./error.js";

const here = dirname(fileURLToPath(import.meta.url));
const localDataDir = join(here, "..", "..", "data");

/** In-process cache of loaded layer FeatureCollections, by layer name. */
const cache = new Map<string, unknown[]>();

async function loadLayerFeatures(snap: Snapshot, name: string): Promise<unknown[]> {
  const cached = cache.get(name);
  if (cached) return cached;

  let raw: Buffer;
  if (snap.source.kind === "r2" && snap.source.prefix) {
    const env = r2Env();
    const client = r2Client(env);
    raw = await getObject(client, env.bucket, `${snap.source.prefix}/${name}.json`);
  } else {
    const path = join(localDataDir, `${name}.json`);
    if (!existsSync(path)) throw new Error(`layer file not found: ${name}.json`);
    raw = readFileSync(path);
  }
  const parsed = JSON.parse(raw.toString("utf8")) as { features?: unknown[] };
  const features = parsed.features ?? [];
  cache.set(name, features);
  return features;
}

function provenanceFor(snap: Snapshot, name: string): Provenance {
  const layers = (snap.meta.layers ?? []) as Provenance[];
  const match = layers.find((l) => l?.name === name);
  if (match) return match;
  return {
    name,
    url: "",
    retrievedAt: snap.meta.version ?? "unknown",
    kind: "derived",
  };
}

/** Factory: returns an express handler bound to the loaded snapshot. */
export function makeLayersRoute(snap: Snapshot) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = LayerName.safeParse(req.params.name);
    if (!parsed.success) {
      res.status(400).json(apiError(400, "UNKNOWN_LAYER", "error.unknownLayer"));
      return;
    }
    const name = parsed.data;
    try {
      const features = await loadLayerFeatures(snap, name);
      const body = LayerResponse.parse({
        name,
        provenance: provenanceFor(snap, name),
        features,
      });
      // Real data now — no stub header.
      res.json(body);
    } catch (err) {
      res
        .status(503)
        .json(apiError(503, "LAYER_UNAVAILABLE", "error.internal"));
    }
  };
}
