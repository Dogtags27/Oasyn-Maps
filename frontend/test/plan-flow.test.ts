/**
 * plan-flow.test.ts — a plan response lands ranked routes + the recommended id
 * in the store, and a no-path response keeps prior routes (R5.3, R5.6).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient } from "@/api/client";
import { useStore } from "@/store";
import type { RouteResultT, OfferT } from "@/api/types";

function applyPlan(res: {
  routes: RouteResultT[];
  recommendedId: string | null;
  noPath?: unknown;
  offers: OfferT[];
}) {
  const s = useStore.getState();
  if (res.noPath) {
    s.setNoPath(true);
    s.setOffers(res.offers);
    return;
  }
  s.setRoutes(res.routes, res.recommendedId);
  s.setOffers(res.offers);
}

describe("plan flow", () => {
  beforeEach(() => {
    useStore.setState({ routes: [], selectedId: null, recommendedId: null, noPath: false });
  });

  it("stores ranked routes and selects the recommended one", async () => {
    const client = new ApiClient({ mode: "mock" });
    const res = await client.plan({
      from: { lat: 42.348, lng: -71.081 },
      to: { lat: 42.3398, lng: -71.0892 },
      mode: "balanced",
      scenario: {
        timeISO: "2026-07-21T14:00:00-04:00",
        tempC: 32,
        rh: 50,
        cloud: 0.2,
        priorWalkMin: 0,
        stepFree: false,
        zones: [],
        liveWeather: false,
      },
    });
    applyPlan(res);
    const s = useStore.getState();
    expect(s.routes.length).toBeGreaterThan(0);
    expect(s.recommendedId).toBe("sample-route-balanced");
    expect(s.selectedId).toBe("sample-route-balanced");
  });

  it("keeps prior routes on no-path", () => {
    const prior: RouteResultT = {
      id: "prior",
      mode: "balanced",
      geometry: [
        { lat: 42.348, lng: -71.081 },
        { lat: 42.3398, lng: -71.0892 },
      ],
      timeSec: 600,
      distanceM: 800,
      heatMinutes: 4,
      shadePct: 60,
      arrivalBand: "low",
      safetyMax: 0.1,
      oases: [],
      j: 0.5,
      feasible: true,
      turns: [],
      aTrace: [[0, 0, 0.2]],
      explanations: [],
    };
    useStore.getState().setRoutes([prior], "prior");
    applyPlan({ routes: [], recommendedId: null, noPath: { key: "route.noPath" }, offers: [] });
    const s = useStore.getState();
    expect(s.noPath).toBe(true);
    expect(s.routes.map((r) => r.id)).toEqual(["prior"]);
  });
});
