/**
 * routes/config.ts — GET /api/config (R13.3).
 *
 * Returns the public config slice so the frontend hardcodes no thresholds.
 * This is computed data (not a fixture), so no stub header.
 */

import type { Request, Response } from "express";
import { publicConfig } from "../config.js";

export function getConfig(_req: Request, res: Response): void {
  res.json(publicConfig);
}
