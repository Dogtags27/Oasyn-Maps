/**
 * core/astar.ts — exact shortest-path search over the CSR snapshot (R6.1, R8.1,
 * R9.1, R12.1).
 *
 * Deterministic: ties broken by node id (R6.8). No Date / Math.random.
 *
 *   - A binary min-heap with LAZY decrease-key: we push duplicates and skip
 *     stale pops via a `settled` bitmap. Simpler and faster in practice than an
 *     indexed heap for road graphs.
 *   - astar(from, to, costFn, hFn): stops when the goal is popped.
 *   - dijkstraTree(source, costFn): full forward or backward tree.
 *   - multiSource(sources, costFn): one tree from many zero-dist sources.
 *
 * costFn(edgeId, fromNode, toNode) returns the arc cost (Infinity = blocked).
 * hFn(node) is an admissible, consistent lower bound to the goal (0 for Dijkstra).
 */

import type { GraphView } from "./graph.js";

/** Tie-aware key so equal priorities are ordered by node id. */
type HeapItem = { node: number; prio: number };

/** Minimal binary heap ordered by (prio, node id). */
class MinHeap {
  private a: HeapItem[] = [];
  get size(): number {
    return this.a.length;
  }
  private less(i: number, j: number): boolean {
    const x = this.a[i]!;
    const y = this.a[j]!;
    return x.prio < y.prio || (x.prio === y.prio && x.node < y.node);
  }
  push(node: number, prio: number): void {
    const a = this.a;
    a.push({ node, prio });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        [a[i], a[p]] = [a[p]!, a[i]!];
        i = p;
      } else break;
    }
  }
  pop(): HeapItem | undefined {
    const a = this.a;
    const n = a.length;
    if (n === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (n > 1) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < a.length && this.less(l, s)) s = l;
        if (r < a.length && this.less(r, s)) s = r;
        if (s === i) break;
        [a[i], a[s]] = [a[s]!, a[i]!];
        i = s;
      }
    }
    return top;
  }
}

export type CostFn = (edge: number, from: number, to: number) => number;
export type HeuristicFn = (node: number) => number;

export interface AStarResult {
  /** edge ids along the path, from start to goal (empty if from === to). */
  edges: number[];
  /** node ids along the path, from start to goal. */
  nodes: number[];
  /** total path cost. */
  dist: number;
  /** true if the goal was reached. */
  found: boolean;
}

/** A* from `from` to `to`. Ties by node id; stops when goal is popped. */
export function astar(
  g: GraphView,
  from: number,
  to: number,
  costFn: CostFn,
  hFn: HeuristicFn,
): AStarResult {
  const V = g.snap.V;
  const dist = new Float64Array(V).fill(Infinity);
  const prevNode = new Int32Array(V).fill(-1);
  const prevEdge = new Int32Array(V).fill(-1);
  const settled = new Uint8Array(V);

  dist[from] = 0;
  const heap = new MinHeap();
  heap.push(from, hFn(from));

  while (heap.size > 0) {
    const item = heap.pop()!;
    const u = item.node;
    if (settled[u]) continue;
    settled[u] = 1;
    if (u === to) break;
    const du = dist[u]!;
    g.forEachNeighbour(u, (v, e) => {
      if (settled[v]) return;
      const c = costFn(e, u, v);
      if (!Number.isFinite(c)) return;
      const nd = du + c;
      if (nd < dist[v]!) {
        dist[v] = nd;
        prevNode[v] = u;
        prevEdge[v] = e;
        heap.push(v, nd + hFn(v));
      }
    });
  }

  if (from === to) return { edges: [], nodes: [from], dist: 0, found: true };
  if (!settled[to]) return { edges: [], nodes: [], dist: Infinity, found: false };

  // Reconstruct.
  const edges: number[] = [];
  const nodes: number[] = [to];
  let cur = to;
  while (cur !== from) {
    edges.push(prevEdge[cur]!);
    cur = prevNode[cur]!;
    nodes.push(cur);
  }
  edges.reverse();
  nodes.reverse();
  return { edges, nodes, dist: dist[to]!, found: true };
}

export interface Tree {
  dist: Float64Array;
  prevNode: Int32Array;
  prevEdge: Int32Array;
}

/**
 * Dijkstra tree from a single source. `backward` reverses arc direction; since
 * the graph is undirected the traversal is identical, but the semantic (dist-to
 * vs dist-from) is documented by the caller.
 */
export function dijkstraTree(g: GraphView, source: number, costFn: CostFn): Tree {
  return multiSource(g, [source], costFn);
}

/** One Dijkstra tree from many zero-distance sources (R12.1 coverage). */
export function multiSource(g: GraphView, sources: number[], costFn: CostFn): Tree {
  const V = g.snap.V;
  const dist = new Float64Array(V).fill(Infinity);
  const prevNode = new Int32Array(V).fill(-1);
  const prevEdge = new Int32Array(V).fill(-1);
  const settled = new Uint8Array(V);
  const heap = new MinHeap();

  // Deterministic: ascending source ids.
  const srcs = [...sources].sort((a, b) => a - b);
  for (const s of srcs) {
    if (dist[s] !== 0) {
      dist[s] = 0;
      heap.push(s, 0);
    }
  }

  while (heap.size > 0) {
    const u = heap.pop()!.node;
    if (settled[u]) continue;
    settled[u] = 1;
    const du = dist[u]!;
    g.forEachNeighbour(u, (v, e) => {
      if (settled[v]) return;
      const c = costFn(e, u, v);
      if (!Number.isFinite(c)) return;
      const nd = du + c;
      if (nd < dist[v]!) {
        dist[v] = nd;
        prevNode[v] = u;
        prevEdge[v] = e;
        heap.push(v, nd);
      }
    });
  }
  return { dist, prevNode, prevEdge };
}
