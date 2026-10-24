/**
 * snapshot-format.test.ts — binary snapshot + CSR + contraction invariants
 * (supports R1.1, R1.6, R2.6). Runs on small synthetic graphs, no network.
 */

import { describe, it, expect } from "vitest";
// The format/build libs are plain ESM .mjs shared with the build script.
import { encodeSnapshot, decodeSnapshot } from "../scripts/lib/snapshot-format.mjs";
import {
  makeProjection,
  contract,
  toCSR,
  type Graph,
} from "../scripts/lib/graph-build.mjs";

const center = { lat: 42.341, lon: -71.084 };
const project = makeProjection(center).project;

/** A small chain graph: 0-1-2-3-4, where 1,2,3 are degree-2 (contractible). */
function chainGraph(): Graph {
  const nodes: [number, number][] = [
    [42.340, -71.090],
    [42.341, -71.088],
    [42.342, -71.086],
    [42.343, -71.084],
    [42.344, -71.082],
  ];
  const mk = (u: number, v: number) => ({
    u,
    v,
    len: 100,
    kind: "footway",
    step: false,
    trees: 2,
    park: 0.5,
    bldg: 1,
    geom: [nodes[u], nodes[v]] as [number, number][],
  });
  return { nodes, edges: [mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 4)] };
}

describe("CSR assembly", () => {
  it("offsets end at 2E and targets are valid node ids", () => {
    const g = chainGraph();
    const csr = toCSR(g, project);
    expect(csr.arrays.offsets[csr.V]).toBe(2 * csr.E);
    for (const t of csr.arrays.targets) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(csr.V);
    }
  });
});

describe("degree-2 contraction (R1.6)", () => {
  it("collapses a chain to a single edge, preserving total length", () => {
    const g = chainGraph();
    const rawLen = g.edges.reduce((s, e) => s + e.len, 0);
    const c = contract(g);
    // 0-1-2-3-4 with 1,2,3 degree-2 -> one edge 0..4 (2 surviving nodes).
    expect(c.edges.length).toBe(1);
    expect(c.nodes.length).toBe(2);
    const merged = c.edges[0]!;
    expect(merged.len).toBeCloseTo(rawLen, 6);
    // length-weighted feature average of equal-length edges = the common value.
    expect(merged.trees).toBeCloseTo(2, 6);
    expect(merged.park).toBeCloseTo(0.5, 6);
  });

  it("does not merge across a step/non-step boundary", () => {
    const g = chainGraph();
    g.edges[1]!.step = true; // edge 1-2 is stairs
    const c = contract(g);
    // Node 1 and 2 now sit on a step boundary, so the chain can't fully collapse.
    expect(c.edges.length).toBeGreaterThan(1);
    const totalLen = c.edges.reduce((s, e) => s + e.len, 0);
    expect(totalLen).toBeCloseTo(400, 6);
  });
});

describe("binary snapshot round-trip (R1.1, R2.6)", () => {
  it("encodes and decodes to identical CSR arrays", () => {
    const g = chainGraph();
    const csr = toCSR(g, project) as any;
    csr.projection = { center };
    const bin = encodeSnapshot(csr);
    const dec = decodeSnapshot(bin);

    expect(dec.V).toBe(csr.V);
    expect(dec.E).toBe(csr.E);
    expect(dec.projection.center.lat).toBeCloseTo(center.lat, 9);
    const keys = Object.keys(csr.arrays) as Array<keyof typeof csr.arrays>;
    for (const name of keys) {
      const a = csr.arrays[name] as ArrayLike<number>;
      const b = dec.arrays[name as keyof typeof dec.arrays] as ArrayLike<number>;
      expect(b.length).toBe(a.length);
      for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i]!, 4);
    }
  });

  it("rejects a buffer with a bad magic", () => {
    const g = chainGraph();
    const csr = toCSR(g, project) as any;
    csr.projection = { center };
    const bin = encodeSnapshot(csr);
    bin[0] = 0x00; // corrupt magic
    expect(() => decodeSnapshot(bin)).toThrow(/bad magic/);
  });
});
