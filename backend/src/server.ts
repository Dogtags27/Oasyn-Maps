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
import { makeMetaRoute } from "./routes/meta.js";
import { getConfig } from "./routes/config.js";
import { makeLayersRoute } from "./routes/layers.js";
import { makePlanRoute } from "./routes/plan.js";
import { makeReplanRoute } from "./routes/replan.js";
import { makeCoverageRoute } from "./routes/coverage.js";
import { makeDepartureRoute } from "./routes/departure.js";
import { postBody } from "./routes/body.js";
import { postEscalationStep } from "./routes/escalation.js";
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
  // "*" (or unset) means open; trailing slashes are dropped because browsers
  // send the Origin header without one.
  const origins = process.env.CORS_ORIGIN?.split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const pinned = origins && origins.length > 0 && !origins.includes("*");
  app.use(cors(pinned ? { origin: origins } : {}));

  app.use(express.json({ limit: "1mb" }));

  // --- Health + root ---------------------------------------------------------

  // Load balancer / uptime checks ping this. It reports whether the real
  // snapshot is loaded so a misconfigured deploy (e.g. missing R2 credentials)
  // is visible at a glance instead of silently serving sample data.
  const snapshotInfo = snapshot
    ? {
        loaded: true,
        source: snapshot.source.kind,
        version: snapshot.meta.version,
        nodes: snapshot.V,
        edges: snapshot.E,
      }
    : { loaded: false };
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      stub: !snapshot,
      snapshot: snapshotInfo,
    });
  });

  // Friendly index so a browser hitting the base URL sees something useful.
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: snapshot ? "oasyn-maps backend" : "oasyn-maps backend (stub)",
      contractVersion: CONTRACT_VERSION,
      snapshot: snapshotInfo,
      note: snapshot
        ? "Live engine: endpoints are computed from the loaded graph snapshot."
        : "Stub mode: no snapshot loaded. Endpoints return validated sample fixtures with X-Oasyn-Stub: true.",
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

  app.get("/api/meta", makeMetaRoute(snapshot));
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

  // Body and escalation are pure (no snapshot needed) — always real.
  app.post("/api/body", postBody);
  app.post("/api/escalation/step", postEscalationStep);

  if (snapshot) {
    // Real engine endpoints (no stub header).
    app.post("/api/plan", makePlanRoute(snapshot));
    app.post("/api/replan", makeReplanRoute(snapshot));
    app.post("/api/coverage", makeCoverageRoute(snapshot));
    app.post("/api/departure", makeDepartureRoute(snapshot));
  } else {
    post("/api/plan", PlanRequest, "plan");
    post("/api/replan", ReplanRequest, "replan");
    post("/api/coverage", CoverageRequest, "coverage");
    post("/api/departure", DepartureRequest, "departure");
  }

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
  // REQUIRE_SNAPSHOT=1 (set in the Docker image) makes a failed snapshot load
  // fatal: the process exits, the container is marked unhealthy, and the
  // orchestrator retries / rolls back, instead of quietly serving sample data.
  const requireSnapshot = process.env.REQUIRE_SNAPSHOT === "1" && !stubOnly;
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
        if (requireSnapshot) {
          console.error(
            `[oasyn] FATAL: snapshot load failed (${(err as Error).message}). ` +
              "Check the R2_* environment variables / secrets. Exiting.",
          );
          process.exit(1);
        }
        console.warn(
          `[oasyn] no snapshot (${(err as Error).message}); serving stub layers.`,
        );
      }
    }
    const app = createServer(snapshot);
    const server = app.listen(port, () => {
      // Statelessness (R14.4): never log coordinates or identifiers.
      console.log(`[oasyn] backend listening on :${port}${snapshot ? "" : " (stub)"}`);
    });
    // Containers are stopped with SIGTERM on every deploy/scale-in: finish
    // in-flight requests, then exit (force after 10 s).
    const shutdown = (signal: string) => {
      console.log(`[oasyn] ${signal} received, shutting down`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 10_000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  };
  void boot();
}
