/**
 * routes/escalation.ts — real POST /api/escalation/step (R10.4-R10.7, R13.2).
 *
 * One pure reducer step. When the next phase is dispatch_sim, attach a
 * descriptor of the data that *would* be shared, permanently flagged simulated —
 * no network request is ever made (R10.7). No stub header.
 */

import type { Request, Response } from "express";
import { EscalationRequest, EscalationResponse } from "../../contract/schemas.js";
import { step } from "../core/escalation.js";
import { d } from "../core/descriptors.js";
import { zodToApiError, sendError } from "./error.js";

const isDev = process.env.NODE_ENV !== "production";

export function postEscalationStep(req: Request, res: Response): void {
  const parsed = EscalationRequest.safeParse(req.body);
  if (!parsed.success) {
    const body = zodToApiError(parsed.error);
    res.status(body.status).json(body);
    return;
  }
  try {
    const { state, tcUsed, nowMs, action } = parsed.data;
    const next = step(state, tcUsed, nowMs, action);
    const payload = {
      state: next,
      ...(next.phase === "dispatch_sim" ? { dispatchInfo: d("escalation.dispatch.sharedData") } : {}),
      simulated: true as const,
    };
    const body = isDev ? EscalationResponse.parse(payload) : payload;
    res.json(body);
  } catch (err) {
    sendError(res, err);
  }
}
