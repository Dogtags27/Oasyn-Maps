/**
 * routes/error.ts — ApiError mapping and the X-Oasyn-Stub helper (R13.5, R13.6).
 */

import type { Response } from "express";
import { ZodError } from "zod";
import type { ApiError } from "../../contract/schemas.js";

/** Marks a response as a stub (fixture-backed) per R13.6. */
export function stub(res: Response): Response {
  res.setHeader("X-Oasyn-Stub", "true");
  return res;
}

/** Builds a stable ApiError body with descriptor messages. */
export function apiError(
  status: number,
  code: string,
  messageKey: string,
  issues?: ApiError["issues"],
): ApiError {
  return {
    error: true,
    status,
    code,
    message: { key: messageKey },
    ...(issues && issues.length ? { issues } : {}),
  };
}

/** Maps a zod failure to a 422 ApiError with per-issue descriptors. */
export function zodToApiError(err: ZodError): ApiError {
  const issues = err.issues.map((i) => ({
    path: i.path.join("."),
    message: { key: "error.validation", vars: { path: i.path.join(".") } },
  }));
  return apiError(422, "VALIDATION", "error.badRequest", issues);
}

/** Sends an ApiError, falling back to 500 on unexpected throws. */
export function sendError(res: Response, err: unknown): void {
  if (err instanceof ZodError) {
    const body = zodToApiError(err);
    res.status(body.status).json(body);
    return;
  }
  const body = apiError(500, "INTERNAL", "error.internal");
  res.status(500).json(body);
}
