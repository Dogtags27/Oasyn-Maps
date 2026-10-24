/**
 * contract.test.ts — the contract gate (R17.5, R13.4, R13.8).
 *
 *  1. Every fixture's `response` validates against its endpoint schema.
 *  2. Every descriptor key referenced anywhere in the fixtures exists in
 *     messages.json.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import type { ZodTypeAny } from "zod";
import {
  MetaResponse,
  ConfigResponse,
  PresetsResponse,
  LayerResponse,
  PlanResponse,
  ReplanResponse,
  BodyResponse,
  EscalationResponse,
  CoverageResponse,
  DepartureResponse,
  SearchResponse,
  Descriptor,
} from "../contract/schemas.js";

const here = dirname(fileURLToPath(import.meta.url));
const contractDir = join(here, "..", "contract");
const fixturesDir = join(contractDir, "fixtures");

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(fixturesDir, `${name}.json`), "utf8");
  return (JSON.parse(raw) as { response: unknown }).response;
}

const cases: Array<[string, ZodTypeAny]> = [
  ["meta", MetaResponse],
  ["config", ConfigResponse],
  ["presets", PresetsResponse],
  ["layers", LayerResponse],
  ["plan", PlanResponse],
  ["replan", ReplanResponse],
  ["body", BodyResponse],
  ["escalation", EscalationResponse],
  ["coverage", CoverageResponse],
  ["departure", DepartureResponse],
  ["search", SearchResponse],
];

describe("fixtures validate against their schema (R13.8)", () => {
  for (const [name, schema] of cases) {
    it(`${name} fixture matches schema`, () => {
      const payload = loadFixture(name);
      const result = schema.safeParse(payload);
      if (!result.success) {
        throw new Error(
          `${name} fixture failed schema: ${JSON.stringify(result.error.issues, null, 2)}`,
        );
      }
      expect(result.success).toBe(true);
    });
  }
});

/** Recursively collect every object that looks like a Descriptor {key, vars?}. */
function collectDescriptorKeys(value: unknown, acc: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectDescriptorKeys(v, acc);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const maybe = Descriptor.safeParse(obj);
    if (maybe.success && typeof obj.key === "string") {
      acc.add(obj.key);
    }
    for (const v of Object.values(obj)) collectDescriptorKeys(v, acc);
  }
}

describe("every descriptor key exists in messages.json (R13.4)", () => {
  it("no fixture references an unknown key", () => {
    const messages = JSON.parse(
      readFileSync(join(contractDir, "messages.json"), "utf8"),
    ) as Record<string, unknown>;
    const known = new Set(Object.keys(messages).filter((k) => !k.startsWith("_")));

    const used = new Set<string>();
    for (const [name] of cases) collectDescriptorKeys(loadFixture(name), used);

    const missing = [...used].filter((k) => !known.has(k));
    expect(missing, `missing keys in messages.json: ${missing.join(", ")}`).toEqual([]);
  });
});
