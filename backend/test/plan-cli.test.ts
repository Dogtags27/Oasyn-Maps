/**
 * plan-cli.test.ts — smoke test for the headless CLI (R16.1).
 *
 * Exercises the CLI's input-validation path without network: an invalid
 * PlanRequest must exit non-zero with a clear message (and must NOT attempt a
 * snapshot load). The happy path (valid request -> PlanResponse) is validated
 * manually against the live R2 snapshot; keeping the automated smoke test
 * network-free keeps CI fast and deterministic.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "scripts", "plan-cli.mjs");

function runCli(input: string) {
  return spawnSync("npx", ["tsx", cli], {
    input,
    encoding: "utf8",
    shell: process.platform === "win32",
    cwd: join(here, ".."),
  });
}

describe("plan-cli smoke (R16.1)", () => {
  it("rejects an invalid PlanRequest with a non-zero exit", () => {
    const res = runCli(JSON.stringify({ not: "a valid request" }));
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/invalid PlanRequest/i);
  });

  it("rejects empty input with a clear message", () => {
    const res = runCli("");
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/no scenario/i);
  });
});
