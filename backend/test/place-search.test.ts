/**
 * place-search.test.ts — GET /api/search building blocks: normalisation,
 * scoring, Photon mapping (bbox filter), merge/dedupe, and the route's
 * graceful degradation when the geocoder is unreachable.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { normalise, scoreName, fromPhoton, merge } from "../src/routes/search.js";
import { SearchResponse, type SearchResult } from "../contract/schemas.js";

const r = (over: Partial<SearchResult>): SearchResult => ({
  id: "x",
  name: "X",
  at: { lat: 42.34, lng: -71.08 },
  kind: "place",
  source: "local",
  ...over,
});

describe("normalise / scoreName", () => {
  it("strips case, accents and punctuation", () => {
    expect(normalise("  Café   St. Botolph's ")).toBe("cafe st botolph s");
    expect(normalise("Perkins & Jamaicaway")).toBe("perkins and jamaicaway");
  });

  it("ranks exact > prefix > word-prefix > tokens > substring", () => {
    const q = normalise("fen");
    expect(scoreName("fen", q)).toBeGreaterThan(scoreName("fenway", q));
    expect(scoreName("fenway", q)).toBeGreaterThan(scoreName("west fenway", q));
    expect(scoreName("west fenway", q)).toBeGreaterThan(scoreName("olmsted fens", "msted"));
    expect(scoreName("back bay fens", normalise("bay fens"))).toBeGreaterThan(0);
    expect(scoreName("charles river esplanade", normalise("riv espl"))).toBe(55);
    expect(scoreName("dorchester", "xyz")).toBe(0);
  });
});

describe("fromPhoton", () => {
  it("maps a named POI with address detail", () => {
    const out = fromPhoton(
      {
        geometry: { coordinates: [-71.0971, 42.34646] },
        properties: {
          name: "Fenway Park",
          housenumber: "4",
          street: "Jersey Street",
          city: "Boston",
          osm_type: "W",
          osm_id: 123,
          osm_key: "leisure",
          osm_value: "stadium",
        },
      },
      0,
    );
    expect(out).toMatchObject({
      id: "osm:W123",
      name: "Fenway Park",
      detail: "4 Jersey Street, Boston",
      kind: "poi",
      source: "geocoder",
    });
  });

  it("uses the street address as the name for bare addresses", () => {
    const out = fromPhoton(
      {
        geometry: { coordinates: [-71.08, 42.34] },
        properties: { housenumber: "360", street: "Huntington Avenue", city: "Boston" },
      },
      3,
    );
    expect(out?.name).toBe("360 Huntington Avenue");
    expect(out?.kind).toBe("address");
    expect(out?.detail).toBe("Boston");
  });

  it("drops results outside the snapshot bbox (not routable)", () => {
    const out = fromPhoton(
      { geometry: { coordinates: [-73.98, 40.75] }, properties: { name: "Times Square" } },
      0,
    );
    expect(out).toBeNull();
  });
});

describe("merge", () => {
  it("keeps order, respects limit, and drops same-name neighbours", () => {
    const local = [r({ id: "a", name: "Fenway" })];
    const remote = [
      r({ id: "b", name: "fenway", at: { lat: 42.3401, lng: -71.0801 }, source: "geocoder" }),
      r({ id: "c", name: "Fenway Park", source: "geocoder" }),
      r({ id: "d", name: "Fenway Garden", source: "geocoder" }),
    ];
    const out = merge(local, remote, 2);
    expect(out.map((o) => o.id)).toEqual(["a", "c"]);
  });
});

describe("GET /api/search route", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function call(path: string) {
    const { createServer } = await import("../src/server.js");
    const server = createServer().listen(0);
    try {
      const port = (server.address() as { port: number }).port;
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      return { status: res.status, body: (await res.json()) as unknown };
    } finally {
      server.close();
    }
  }

  it("rejects a too-short query with a 422 ApiError", async () => {
    const { status, body } = await call("/api/search?q=a");
    expect(status).toBe(422);
    expect(body).toMatchObject({ error: true, code: "VALIDATION" });
  });

  it("degrades to local-only (no error) when the geocoder is unreachable", async () => {
    const realFetch = globalThis.fetch;
    // Fail only outgoing geocoder calls; let the test's own request through.
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("127.0.0.1")) return realFetch(input, init);
      return Promise.reject(new TypeError("network down"));
    });
    const { status, body } = await call("/api/search?q=zzz-unlikely-name");
    expect(status).toBe(200);
    const parsed = SearchResponse.parse(body);
    expect(parsed.degraded).toBe(true);
    expect(parsed.results).toEqual([]);
  });
});
