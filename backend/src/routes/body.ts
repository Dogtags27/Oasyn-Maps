/**
 * routes/body.ts — real POST /api/body (R10.1-R10.3, R13.2).
 *
 * Returns the modeled core temperature, its +/- range, band, and pf uplift.
 * Labels: "illustrative model" by default, or SIMULATED when the value is the
 * wearable observation (honesty principle). No stub header.
 */

import type { Request, Response } from "express";
import { BodyRequest, BodyResponse } from "../../contract/schemas.js";
import { tcModel, tcRange, tcUsed, pfUplift } from "../core/body.js";
import { band } from "../core/exposure.js";
import { d } from "../core/descriptors.js";
import { zodToApiError, sendError } from "./error.js";

const isDev = process.env.NODE_ENV !== "production";

export function postBody(req: Request, res: Response): void {
  const parsed = BodyRequest.safeParse(req.body);
  if (!parsed.success) {
    const body = zodToApiError(parsed.error);
    res.status(body.status).json(body);
    return;
  }
  try {
    const { a, hr, tcObs, wearableOn } = parsed.data;
    const model = tcModel(a, hr);
    const used = tcUsed({ model, obs: tcObs, wearableOn });
    const range = tcRange(used);
    const uplift = pfUplift(tcObs, model);
    const simulated = wearableOn && tcObs !== undefined;

    const payload = {
      tcModel: model,
      tcUsed: used,
      rangeLow: range.low,
      rangeHigh: range.high,
      band: band(a),
      pfUplift: uplift.factor,
      label: simulated ? d("body.label.simulatedWearable") : d("body.label.illustrative"),
      simulated,
    };
    const body = isDev ? BodyResponse.parse(payload) : payload;
    res.json(body);
  } catch (err) {
    sendError(res, err);
  }
}
