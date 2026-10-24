/**
 * routes/meta.ts — GET /api/meta (R13.3, R13.2).
 *
 * Returns provenance from the committed data/meta.json plus CONTRACT_VERSION.
 * Until the snapshot is built, falls back to the sample fixture and sets the
 * stub header.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Request, Response } from "express";
import { CONTRACT_VERSION, MetaResponse } from "../../contract/schemas.js";
import { fixture } from "./fixtures.js";
import { stub } from "./error.js";

const here = dirname(fileURLToPath(import.meta.url));
const metaPath = join(here, "..", "..", "data", "meta.json");

export function getMeta(_req: Request, res: Response): void {
  let payload: unknown;
  let isStub = false;
  try {
    const raw = readFileSync(metaPath, "utf8");
    const meta = JSON.parse(raw) as { layers?: unknown; nodes?: number; edges?: number };
    payload = {
      contractVersion: CONTRACT_VERSION,
      layers: meta.layers ?? [],
      ...(typeof meta.nodes === "number" ? { nodes: meta.nodes } : {}),
      ...(typeof meta.edges === "number" ? { edges: meta.edges } : {}),
    };
  } catch {
    // No committed snapshot yet: serve the sample and flag it.
    payload = { ...(fixture("meta") as object), contractVersion: CONTRACT_VERSION };
    isStub = true;
  }
  const body = MetaResponse.parse(payload);
  if (isStub) stub(res);
  res.json(body);
}
