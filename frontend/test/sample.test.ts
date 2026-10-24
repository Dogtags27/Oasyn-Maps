/**
 * sample.test.ts — every frontend sample seed validates against its contract
 * z.infer type (R2.2, design §16). This is the guarantee that mock mode is
 * schema-shaped before backend fixtures exist.
 */
import { describe, it, expect } from "vitest";
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
} from "@/api/types";

import meta from "@/api/sample/meta.json";
import config from "@/api/sample/config.json";
import presets from "@/api/sample/presets.json";
import plan from "@/api/sample/plan.json";
import replan from "@/api/sample/replan.json";
import body from "@/api/sample/body.json";
import escalation from "@/api/sample/escalation.json";
import coverage from "@/api/sample/coverage.json";
import departure from "@/api/sample/departure.json";
import layersPlaces from "@/api/sample/layers.places.json";
import layersTrees from "@/api/sample/layers.trees.json";
import layersCooling from "@/api/sample/layers.cooling.json";
import layersParks from "@/api/sample/layers.parks.json";
import layersWater from "@/api/sample/layers.water.json";

describe("frontend sample seed validates against the contract", () => {
  it("meta", () => expect(() => MetaResponse.parse(meta.response)).not.toThrow());
  it("config", () => expect(() => ConfigResponse.parse(config.response)).not.toThrow());
  it("presets", () => expect(() => PresetsResponse.parse(presets.response)).not.toThrow());
  it("plan", () => expect(() => PlanResponse.parse(plan.response)).not.toThrow());
  it("replan", () => expect(() => ReplanResponse.parse(replan.response)).not.toThrow());
  it("body", () => expect(() => BodyResponse.parse(body.response)).not.toThrow());
  it("escalation", () =>
    expect(() => EscalationResponse.parse(escalation.response)).not.toThrow());
  it("coverage", () =>
    expect(() => CoverageResponse.parse(coverage.response)).not.toThrow());
  it("departure", () =>
    expect(() => DepartureResponse.parse(departure.response)).not.toThrow());

  it.each([
    ["places", layersPlaces],
    ["trees", layersTrees],
    ["cooling", layersCooling],
    ["parks", layersParks],
    ["water", layersWater],
  ])("layers.%s", (_name, mod) => {
    expect(() => LayerResponse.parse(mod.response)).not.toThrow();
  });
});
