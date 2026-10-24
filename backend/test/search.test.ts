/**
 * search.test.ts — A-star / Dijkstra correctness (R17.2):
 *   - A* == Dijkstra on seeded random small graphs
 *   - blocked edges (Infinity cost) are never used
 *   - degree-2 contraction preserves shortest-path length
 */

import { describe, it, expect } from "vitest";
import { toCSR, contract, makeProjection, type Graph } from "../scripts/lib/graph-build.mjs";
import { mulberry32 } from "../src/rng.js";
import { buildGraphView } from "../src/core/graph.js";
import { astar, dijkstraTree, type CostFn } from "../src/core/astar.js";
import type { Snapshot } from "../src/snapshot.js";

const center = { lat: 42.341, lon: -71.084 };
const project = makeProjection(center).project;

/** Build a minimal Snapshot from a synthetic graph via the real CSR assembler. */
function snapshotFrom(graph: Graph): Snapshot {
  const csr = toCSR(graph, project);
  return {
    V: csr.V,
    E: csr.E,
    center,
    offsets: csr.arrays.offsets,
    targets: csr.arrays.targets,
    edgeOf: csr.arrays.edgeOf,
    len: csr.arrays.len,
    trees: csr.arrays.trees,
    park: csr.arrays.park,
    bldg: csr.arrays.bldg,
    step: csr.arrays.step,
    nodeLat: csr.arrays.nodeLat,
    nodeLon: csr.arrays.nodeLon,
    nodeX: csr.arrays.nodeX,
    nodeY: csr.arrays.nodeY,
    heat: new Float32Array(csr.E),
    safety: new Float32Array(csr.E),
    meta: { version: "test", nodes: csr.V, edges: csr.E, layers: [] },
    source: { kind: "local" },
  };
}

/** Random connected-ish grid graph with jittered coords, deterministic by seed. */
function randomGraph(seed: number, rows: number, cols: number): Graph {
  const rng = mulberry32(seed);
  const nodes: [number, number][] = [];
  const idx = (r: number, c: number) => r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push([center.lat + r * 0.001 + rng() * 0.0002, center.lon + c * 0.001 + rng() * 0.0002]);
    }
  }
  const edges: Graph["edges"] = [];
  const mk = (u: number, v: number) => {
    const [ay, ax] = nodes[u]!;
    const [by, bx] = nodes[v]!;
    const dy = (by - ay) * 111000;
    const dx = (bx - ax) * 82300;
    const len = Math.sqrt(dx * dx + dy * dy) + 1;
    edges.push({ u, v, len, kind: "footway", step: false, trees: 0, park: 0, bldg: 0, geom: [nodes[u]!, nodes[v]!] });
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) mk(idx(r, c), idx(r, c + 1));
      if (r + 1 < rows) mk(idx(r, c), idx(r + 1, c));
    }
  }
  return { nodes, edges };
}

/** cost = edge length; heuristic = straight-line distance (admissible). */
function lengthCost(snap: Snapshot): CostFn {
  return (e) => snap.len[e]!;
}

describe("A* equals Dijkstra (R17.2)", () => {
  for (const seed of [1, 7, 42, 1337]) {
    it(`seed ${seed}: A* distance == Dijkstra distance for all targets`, () => {
      const snap = snapshotFrom(randomGraph(seed, 6, 6));
      const g = buildGraphView(snap);
      const cost = lengthCost(snap);
      const source = 0;
      const tree = dijkstraTree(g, source, cost);

      const cosLat0 = Math.cos((center.lat * Math.PI) / 180);
      for (let target = 1; target < snap.V; target++) {
        const h = (n: number) => {
          const dx = snap.nodeX[target]! - snap.nodeX[n]!;
          const dy = snap.nodeY[target]! - snap.nodeY[n]!;
          return Math.sqrt(dx * dx + dy * dy) * 0.995;
        };
        void cosLat0;
        const res = astar(g, source, target, cost, h);
        expect(res.found).toBe(true);
        expect(res.dist).toBeCloseTo(tree.dist[target]!, 6);
      }
    });
  }
});

describe("blocked edges are never used (R17.2)", () => {
  it("routes around an Infinity-cost edge", () => {
    // Triangle: 0-1 short, 0-2-1 longer. Block 0-1 -> must take 0-2-1.
    const nodes: [number, number][] = [
      [42.340, -71.090],
      [42.340, -71.088],
      [42.341, -71.089],
    ];
    const edge = (u: number, v: number, len: number) => ({
      u, v, len, kind: "footway", step: false, trees: 0, park: 0, bldg: 0,
      geom: [nodes[u]!, nodes[v]!] as [number, number][],
    });
    const graph: Graph = { nodes, edges: [edge(0, 1, 100), edge(0, 2, 90), edge(2, 1, 90)] };
    const snap = snapshotFrom(graph);
    const g = buildGraphView(snap);
    // block the direct edge 0-1 (edge id 0).
    const cost: CostFn = (e) => (e === 0 ? Infinity : snap.len[e]!);
    const res = astar(g, 0, 1, cost, () => 0);
    expect(res.found).toBe(true);
    expect(res.edges).not.toContain(0);
    expect(res.dist).toBeCloseTo(180, 6);
  });
});

describe("contraction preserves shortest-path length (R1.6, R17.2)", () => {
  it("interior-node distances survive contraction", () => {
    // Use a chain with branches so there are genuine degree-2 pass-through
    // nodes AND surviving junction endpoints. Contraction must leave the
    // junction-to-junction shortest-path length unchanged.
    //
    // Layout (lengths 100 each):
    //   A(0) - x(1) - x(2) - B(3) - y(4) - C(5)
    //                          |
    //                         z(6) - D(7)
    // Nodes 1,2,4,6 are degree-2 (contractible); 0,3,5,7 are endpoints/junctions.
    const nodes: [number, number][] = [
      [42.3400, -71.0900], // 0 A
      [42.3400, -71.0890], // 1 x
      [42.3400, -71.0880], // 2 x
      [42.3400, -71.0870], // 3 B (junction, degree 3)
      [42.3400, -71.0860], // 4 y
      [42.3400, -71.0850], // 5 C
      [42.3410, -71.0870], // 6 z
      [42.3420, -71.0870], // 7 D
    ];
    const mk = (u: number, v: number) => ({
      u, v, len: 100, kind: "footway", step: false, trees: 0, park: 0, bldg: 0,
      geom: [nodes[u]!, nodes[v]!] as [number, number][],
    });
    const edges = [mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 4), mk(4, 5), mk(3, 6), mk(6, 7)];

    const rawSnap = snapshotFrom({ nodes: nodes.map((n) => [...n] as [number, number]), edges: edges.map((e) => ({ ...e })) });
    const rawG = buildGraphView(rawSnap);
    const rawTree = dijkstraTree(rawG, 0, lengthCost(rawSnap));
    // A(0) -> C(5) = 5 edges = 500; A(0) -> D(7) = 0-1-2-3-6-7 = 500.
    const rawAC = rawTree.dist[5]!;
    const rawAD = rawTree.dist[7]!;
    expect(rawAC).toBeCloseTo(500, 6);

    const contracted = contract({ nodes: nodes.map((n) => [...n] as [number, number]), edges: edges.map((e) => ({ ...e })) });
    const cSnap = snapshotFrom(contracted);
    const cG = buildGraphView(cSnap);
    // Endpoints A, C, D are junctions/leaves and survive; snap by coordinate.
    const A = cG.snapNode(nodes[0]![0], nodes[0]![1]);
    const C = cG.snapNode(nodes[5]![0], nodes[5]![1]);
    const D = cG.snapNode(nodes[7]![0], nodes[7]![1]);
    const cTree = dijkstraTree(cG, A, lengthCost(cSnap));
    expect(cTree.dist[C]!).toBeCloseTo(rawAC, 6);
    expect(cTree.dist[D]!).toBeCloseTo(rawAD, 6);
    // And the chain 0-1-2-3 collapsed: node 3 (B) is a junction so it survives,
    // but the A..B segment is now a single edge.
    expect(contracted.edges.length).toBeLessThan(edges.length);
  });
});
