/**
 * routes/meta.ts — GET /api/meta (R13.3, R13.2).
 *
 * Provenance source precedence:
 *   1. the loaded snapshot's meta (R2 or local) — what the engine actually uses;
 *   2. a local data/meta.json (dev convenience when no snapshot was passed in);
 *   3. the sample fixture, flagged with the stub header.
 *
 * (1) matters in container deploys: data/ is not shipped in the image, so
 * without it /api/meta would report sample provenance even though the live
 * snapshot loaded fine from R2.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Request, Response } from "express";
import { CONTRACT_VERSION, MetaResponse } from "../../contract/schemas.js";
import type { Snapshot } from "../snapshot.js";
import { fixture } from "./fixtures.js";
import { stub } from "./error.js";

const here = dirname(fileURLToPath(import.meta.url));
const metaPath = join(here, "..", "..", "data", "meta.json");

interface MetaLike {
  layers?: unknown;
  nodes?: number;
  edges?: number;
}

function payloadFrom(meta: MetaLike): unknown {
  return {
    contractVersion: CONTRACT_VERSION,
    layers: meta.layers ?? [],
    ...(typeof meta.nodes === "number" ? { nodes: meta.nodes } : {}),
    ...(typeof meta.edges === "number" ? { edges: meta.edges } : {}),
  };
}

/** Factory: GET /api/meta bound to the loaded snapshot (if any). */
export function makeMetaRoute(snapshot?: Snapshot) {
  return (_req: Request, res: Response): void => {
    let payload: unknown;
    let isStub = false;
    if (snapshot) {
      payload = payloadFrom(snapshot.meta);
    } else {
      try {
        payload = payloadFrom(JSON.parse(readFileSync(metaPath, "utf8")) as MetaLike);
      } catch {
        // No snapshot and no local meta: serve the sample and flag it.
        payload = { ...(fixture("meta") as object), contractVersion: CONTRACT_VERSION };
        isStub = true;
      }
    }
    const body = MetaResponse.parse(payload);
    if (isStub) stub(res);
    res.json(body);
  };
}

/** Snapshot-less handler, kept for callers that import it directly. */
export const getMeta = makeMetaRoute();
