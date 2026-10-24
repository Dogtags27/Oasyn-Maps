/**
 * client.test.ts — mock/live switch, stale-response dropping, debounce (R2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, StaleResponseError, debounce } from "@/api/client";
import type { PlanRequestT, ScenarioT } from "@/api/types";

const scenario: ScenarioT = {
  timeISO: "2026-07-21T14:00:00-04:00",
  tempC: 32,
  rh: 50,
  cloud: 0.2,
  priorWalkMin: 0,
  stepFree: false,
  zones: [],
  liveWeather: false,
};

const planReq: PlanRequestT = {
  from: { lat: 42.348, lng: -71.081 },
  to: { lat: 42.3398, lng: -71.0892 },
  mode: "balanced",
  scenario,
};

describe("ApiClient mock mode", () => {
  it("returns schema-valid plan from the sample seed", async () => {
    const client = new ApiClient({ mode: "mock" });
    const res = await client.plan(planReq);
    expect(res.routes.length).toBeGreaterThan(0);
    expect(res.recommendedId).toBeTruthy();
  });

  it("flags sample mode via the hook", () => {
    const onSampleMode = vi.fn();
    new ApiClient({ mode: "mock", hooks: { onSampleMode } });
    expect(onSampleMode).toHaveBeenCalledWith(true);
  });

  it("loads config so escalation thresholds are available", async () => {
    const client = new ApiClient({ mode: "mock" });
    await client.getConfig();
    const res = await client.escalationStep({
      state: { phase: "normal" },
      tcUsed: 39.5, // above T2
      nowMs: 1_000,
      action: "none",
    });
    expect(res.state.phase).toBe("countdown");
    expect(res.state.deadlineMs).toBe(1_000 + 60 * 1000);
  });
});

describe("stale response dropping", () => {
  it("drops all but the latest plan on a channel", async () => {
    // Force a slow live fetch so two calls overlap; the first must be stale.
    const responses = [
      { routes: [], recommendedId: null, offers: [] },
      { routes: [], recommendedId: null, offers: [] },
    ];
    let call = 0;
    const fetchMock = vi.fn(async () => {
      const idx = call++;
      await new Promise((r) => setTimeout(r, idx === 0 ? 30 : 5));
      return {
        ok: true,
        json: async () => responses[idx],
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({ mode: "live", base: "http://test" });
    const first = client.plan(planReq).catch((e) => e);
    const second = await client.plan(planReq);
    const firstResult = await first;

    expect(firstResult).toBeInstanceOf(StaleResponseError);
    expect(second).toBeTruthy();
  });
});

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("invokes only once for rapid calls", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    d(3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });
});
