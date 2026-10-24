/**
 * server.ts — HTTP bootstrap. Mounts every contract endpoint.
 *
 * Hour 1 state: most endpoints return their sample fixture with the
 * `X-Oasyn-Stub: true` header (R13.6), while still validating request bodies
 * against the zod schema (R13.2). `/api/config` and `/api/meta` are real.
 * Later hours replace stub bodies with the live engine and drop the header.
 */

import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import cors from "cors";
import type { ZodTypeAny } from "zod";
import { CONTRACT_VERSION } from "../contract/schemas.js";
import {
  PlanRequest,
  ReplanRequest,
  BodyRequest,
  EscalationRequest,
  CoverageRequest,
  DepartureRequest,
  LayerName,
} from "../contract/schemas.js";
import { fixture } from "./routes/fixtures.js";
import { apiError, sendError, stub, zodToApiError } from "./routes/error.js";
import { getMeta } from "./routes/meta.js";
import { getConfig } from "./routes/config.js";
import { makeLayersRoute } from "./routes/layers.js";
import type { Snapshot } from "./snapshot.js";

/**
 * Build the app. When a loaded `snapshot` is supplied, the layer endpoints go
 * live from it (R2.3, R11); otherwise they stay stubbed (the Render test deploy
 * runs with no snapshot). Routing endpoints remain stubbed until Hour 3.
 */
export function createServer(snapshot?: Snapshot) {
  const app = express();

  // CORS: the frontend calls from a different origin. For the shared test
  // deploy we allow any origin; pin to specific origins later via CORS_ORIGIN
  // (comma-separated). Stateless backend, no cookies, so this is safe here.
  const origins = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
  app.use(cors(origins && origins.length ? { origin: origins } : {}));

  app.use(express.json({ limit: "1mb" }));

  // --- Health + root ---------------------------------------------------------

  // Render (and any uptime check) pings this; also handy for the frontend.
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true, contractVersion: CONTRACT_VERSION, stub: true });
  });

  // Friendly index so a browser hitting the base URL sees something useful.
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "oasyn-maps backend (stub)",
      contractVersion: CONTRACT_VERSION,
      note: "Hour 1 stub server. POST/GET endpoints return validated sample fixtures with X-Oasyn-Stub: true.",
      endpoints: [
        "GET  /api/meta",
        "GET  /api/config",
        "GET  /api/presets",
        "GET  /api/layers/:name",
        "POST /api/plan",
        "POST /api/replan",
        "POST /api/body",
        "POST /api/escalation/step",
        "POST /api/coverage",
        "POST /api/departure",
      ],
    });
  });

  // --- GET endpoints ---------------------------------------------------------

  app.get("/api/meta", getMeta);
  app.get("/api/config", getConfig);

  app.get("/api/presets", (_req: Request, res: Response) => {
    stub(res).json(fixture("presets"));
  });

  if (snapshot) {
    // Live layers from the snapshot (R11) — no stub header.
    app.get("/api/layers/:name", makeLayersRoute(snapshot));
  } else {
    // No snapshot (stub deploy): single sample layer fixture regardless of name.
    app.get("/api/layers/:name", (req: Request, res: Response) => {
      const parsed = LayerName.safeParse(req.params.name);
      if (!parsed.success) {
        res.status(400).json(apiError(400, "UNKNOWN_LAYER", "error.unknownLayer", undefined));
        return;
      }
      stub(res).json(fixture("layers"));
    });
  }

  // --- POST endpoints (validate request, return fixture) ---------------------

  const post = (
    path: string,
    schema: ZodTypeAny,
    fixtureName: string,
  ): void => {
    app.post(path, (req: Request, res: Response) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const body = zodToApiError(parsed.error);
        res.status(body.status).json(body);
        return;
      }
      try {
        stub(res).json(fixture(fixtureName));
      } catch (err) {
        sendError(res, err);
      }
    });
  };

  post("/api/plan", PlanRequest, "plan");
  post("/api/replan", ReplanRequest, "replan");
  post("/api/body", BodyRequest, "body");
  post("/api/escalation/step", EscalationRequest, "escalation");
  post("/api/coverage", CoverageRequest, "coverage");
  post("/api/departure", DepartureRequest, "departure");

  // --- Fallthrough -----------------------------------------------------------

  app.use((_req: Request, res: Response) => {
    res.status(404).json(apiError(404, "NOT_FOUND", "error.badRequest"));
  });

  return app;
}

// Start only when run directly (not when imported by tests).
const entry = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entry) {
  const port = Number(process.env.PORT ?? 8787);
  // STUB_ONLY=1 forces the fixture-only server (the Render test deploy uses this)
  // so it never attempts an R2 fetch. Otherwise try to load the snapshot and go
  // live on layers; fall back to stub mode if the snapshot is unavailable.
  const stubOnly = process.env.STUB_ONLY === "1";
  const boot = async () => {
    let snapshot: Snapshot | undefined;
    if (!stubOnly) {
      try {
        const { loadSnapshot } = await import("./snapshot.js");
        snapshot = await loadSnapshot();
        console.log(
          `[oasyn] snapshot loaded: ${snapshot.V} nodes, ${snapshot.E} edges (${snapshot.source.kind})`,
        );
      } catch (err) {
        console.warn(
          `[oasyn] no snapshot (${(err as Error).message}); serving stub layers.`,
        );
      }
    }
    const app = createServer(snapshot);
    app.listen(port, () => {
      // Statelessness (R14.4): never log coordinates or identifiers.
      console.log(`[oasyn] backend listening on :${port}${snapshot ? "" : " (stub)"}`);
    });
  };
  void boot();
}
