/**
 * routes/fixtures.ts — load a sample fixture's `response` payload by name.
 * Used by stub endpoints (R13.6) until the real engine backs them.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "contract", "fixtures");

/** Reads `<name>.json` and returns its `response` field. */
export function fixture(name: string): unknown {
  const raw = readFileSync(join(fixturesDir, `${name}.json`), "utf8");
  const parsed = JSON.parse(raw) as { response: unknown };
  return parsed.response;
}
