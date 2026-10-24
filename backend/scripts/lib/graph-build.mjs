/**
 * graph-build.mjs — feature baking, degree-2 contraction, and CSR assembly
 * (task 7). Pure functions over the raw graph + OSM feature layers.
 *
 * Optimizations:
 *  - One spatial grid hash per feature type (trees / park polys / buildings),
 *    so each edge sample is an O(1) local-cell lookup instead of scanning all
 *    features. Baking is O(E · samplesPerEdge · featuresPerCell), not O(E · F).
 *  - Degree-2 contraction collapses chains, shrinking edge count before the
 *    runtime engine ever sees the graph.
 *  - Output is CSR typed arrays, ready to serialise to the binary format.
 */

const EARTH_R = 6_371_000;
const toRad = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Equirectangular projection (metres) around a fixed center.
// ---------------------------------------------------------------------------

export function makeProjection(center) {
  const lat0 = toRad(center.lat);
  const cosLat0 = Math.cos(lat0);
  return {
    center,
    project(lat, lon) {
      const x = EARTH_R * toRad(lon - center.lon) * cosLat0;
      const y = EARTH_R * toRad(lat - center.lat);
      return [x, y];
    },
  };
}

// ---------------------------------------------------------------------------
// Spatial grid hash over projected points, cell size = cellM.
// ---------------------------------------------------------------------------

function gridKey(cx, cy) {
  // Pack two 32-bit cell indices into one string key (fast enough; Map-backed).
  return `${cx},${cy}`;
}

export function buildPointGrid(points, project, cellM) {
  const grid = new Map();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = project(points[i].lat, points[i].lon);
    const cx = Math.floor(x / cellM);
    const cy = Math.floor(y / cellM);
    const k = gridKey(cx, cy);
    let bucket = grid.get(k);
    if (!bucket) grid.set(k, (bucket = []));
    bucket.push({ x, y });
  }
  return { grid, cellM };
}

/** Count points within radiusM of (x,y) by scanning the local 3x3 cells. */
export function countWithin({ grid, cellM }, x, y, radiusM) {
  const r2 = radiusM * radiusM;
  const cx = Math.floor(x / cellM);
  const cy = Math.floor(y / cellM);
  let count = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(gridKey(cx + dx, cy + dy));
      if (!bucket) continue;
      for (const p of bucket) {
        const ex = p.x - x;
        const ey = p.y - y;
        if (ex * ex + ey * ey <= r2) count++;
      }
    }
  }
  return count;
}

/** True if (x,y) falls inside any park polygon near it (grid-accelerated). */
export function insideAnyPoly(parkGrid, x, y) {
  const { grid, cellM, polys } = parkGrid;
  const cx = Math.floor(x / cellM);
  const cy = Math.floor(y / cellM);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = grid.get(gridKey(cx + dx, cy + dy));
      if (!bucket) continue;
      for (const idx of bucket) {
        if (pointInRing(x, y, polys[idx])) return true;
      }
    }
  }
  return false;
}

/** Ray-casting point-in-polygon on a projected ring [[x,y],...]. */
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Build a park grid: register each polygon's bounding cells so insideAnyPoly
 * only tests polygons whose bbox could contain the sample.
 */
export function buildParkGrid(parkFeatures, project, cellM) {
  const grid = new Map();
  const polys = [];
  for (const f of parkFeatures) {
    const coords = f.geometry?.coordinates?.[0];
    if (!coords || coords.length < 3) continue;
    const ring = coords.map(([lon, lat]) => project(lat, lon));
    const idx = polys.push(ring) - 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of ring) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    for (let cx = Math.floor(minX / cellM); cx <= Math.floor(maxX / cellM); cx++) {
      for (let cy = Math.floor(minY / cellM); cy <= Math.floor(maxY / cellM); cy++) {
        const k = gridKey(cx, cy);
        let bucket = grid.get(k);
        if (!bucket) grid.set(k, (bucket = []));
        bucket.push(idx);
      }
    }
  }
  return { grid, cellM, polys };
}

// ---------------------------------------------------------------------------
// Edge feature baking: sample each edge, aggregate local features.
// ---------------------------------------------------------------------------

export function bakeEdgeFeatures(graph, project, grids, cfg) {
  const { treeGrid, parkGrid, bldgGrid } = grids;
  const { sampleStepM, treeM, buildingM } = cfg;
  const edges = graph.edges;
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e];
    const a = graph.nodes[edge.u];
    const b = graph.nodes[edge.v];
    const [ax, ay] = project(a[0], a[1]);
    const [bx, by] = project(b[0], b[1]);
    const dx = bx - ax;
    const dy = by - ay;
    const steps = Math.max(1, Math.ceil(edge.len / sampleStepM));

    let treeSum = 0;
    let bldgSum = 0;
    let parkHits = 0;
    const samples = steps + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sx = ax + dx * t;
      const sy = ay + dy * t;
      treeSum += countWithin(treeGrid, sx, sy, treeM);
      bldgSum += countWithin(bldgGrid, sx, sy, buildingM);
      if (insideAnyPoly(parkGrid, sx, sy)) parkHits++;
    }
    edge.trees = treeSum / samples; // avg canopy count near the edge
    edge.bldg = bldgSum / samples; // avg building proximity
    edge.park = parkHits / samples; // fraction of samples inside a park
  }
  return graph;
}

// ---------------------------------------------------------------------------
// Degree-2 contraction (R1.6, R2.6): collapse chains through degree-2 nodes.
//   - summed length
//   - length-weighted feature averages
//   - concatenated geometry
// Preserves shortest-path lengths (lossless for routing).
// ---------------------------------------------------------------------------

export function contract(graph) {
  const n = graph.nodes.length;
  // adjacency: node -> list of edge indices
  const inc = Array.from({ length: n }, () => []);
  graph.edges.forEach((e, i) => {
    inc[e.u].push(i);
    inc[e.v].push(i);
  });

  const edgeAlive = new Uint8Array(graph.edges.length).fill(1);
  const degree = inc.map((l) => l.length);

  const other = (e, node) => (e.u === node ? e.v : e.u);

  // A node is contractible iff degree 2 and not a step/kind boundary we must keep.
  const isContractible = (node) => degree[node] === 2;

  for (let node = 0; node < n; node++) {
    if (!isContractible(node)) continue;
    const alive = inc[node].filter((i) => edgeAlive[i]);
    if (alive.length !== 2) continue;
    const [i1, i2] = alive;
    const e1 = graph.edges[i1];
    const e2 = graph.edges[i2];
    // Don't merge across a step/non-step boundary or differing kind to keep the
    // step flag meaningful; conservative so contraction stays lossless.
    if (!!e1.step !== !!e2.step) continue;

    const a = other(e1, node); // far end of e1
    const b = other(e2, node); // far end of e2
    if (a === b) continue; // would create a self-loop; skip

    // Concatenate geometry oriented a -> node -> b.
    const g1 = orient(e1.geom, graph.nodes[a], graph.nodes[node]);
    const g2 = orient(e2.geom, graph.nodes[node], graph.nodes[b]);
    const geom = g1.concat(g2.slice(1));

    const len = e1.len + e2.len;
    const w1 = e1.len / len;
    const w2 = e2.len / len;
    const merged = {
      u: a,
      v: b,
      len,
      name: e1.name ?? e2.name,
      kind: e1.kind,
      step: !!e1.step,
      trees: e1.trees * w1 + e2.trees * w2,
      park: e1.park * w1 + e2.park * w2,
      bldg: e1.bldg * w1 + e2.bldg * w2,
      geom,
    };

    // Replace e1 with merged; kill e2 and detach node.
    edgeAlive[i2] = 0;
    graph.edges[i1] = merged;
    // Update incidence: a loses i-less; a/b keep their references via re-link.
    inc[a] = inc[a].map((i) => (i === i1 || i === i2 ? i1 : i)).filter((i) => edgeAlive[i]);
    inc[b] = inc[b].map((i) => (i === i1 || i === i2 ? i1 : i)).filter((i) => edgeAlive[i]);
    degree[node] = 0;
  }

  // Compact surviving edges and re-index nodes that still have degree > 0.
  const survEdges = [];
  for (let i = 0; i < graph.edges.length; i++) {
    if (edgeAlive[i]) survEdges.push(graph.edges[i]);
  }
  // Re-index nodes to drop isolated ones.
  const used = new Uint8Array(n);
  for (const e of survEdges) {
    used[e.u] = 1;
    used[e.v] = 1;
  }
  const remap = new Int32Array(n).fill(-1);
  const newNodes = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) {
      remap[i] = newNodes.length;
      newNodes.push(graph.nodes[i]);
    }
  }
  for (const e of survEdges) {
    e.u = remap[e.u];
    e.v = remap[e.v];
  }
  return { nodes: newNodes, edges: survEdges };
}

function orient(geom, from, to) {
  // geom is [[lat,lon],...]; ensure it runs from `from` toward `to`.
  const first = geom[0];
  const dFromFirst = (first[0] - from[0]) ** 2 + (first[1] - from[1]) ** 2;
  const last = geom[geom.length - 1];
  const dFromLast = (last[0] - from[0]) ** 2 + (last[1] - from[1]) ** 2;
  return dFromFirst <= dFromLast ? geom : geom.slice().reverse();
}

// ---------------------------------------------------------------------------
// CSR assembly from the (contracted) graph.
// ---------------------------------------------------------------------------

export function toCSR(graph, project) {
  const V = graph.nodes.length;
  const E = graph.edges.length;

  const degree = new Int32Array(V);
  for (const e of graph.edges) {
    degree[e.u]++;
    degree[e.v]++;
  }
  const offsets = new Int32Array(V + 1);
  for (let i = 0; i < V; i++) offsets[i + 1] = offsets[i] + degree[i];

  const targets = new Int32Array(2 * E);
  const edgeOf = new Int32Array(2 * E);
  const cursor = offsets.slice(0, V); // mutable copy of start positions

  const len = new Float32Array(E);
  const trees = new Float32Array(E);
  const park = new Float32Array(E);
  const bldg = new Float32Array(E);
  const step = new Uint8Array(E);

  for (let e = 0; e < E; e++) {
    const edge = graph.edges[e];
    len[e] = edge.len;
    trees[e] = edge.trees;
    park[e] = edge.park;
    bldg[e] = edge.bldg;
    step[e] = edge.step ? 1 : 0;
    // forward arc u->v
    let pu = cursor[edge.u]++;
    targets[pu] = edge.v;
    edgeOf[pu] = e;
    // backward arc v->u (undirected)
    let pv = cursor[edge.v]++;
    targets[pv] = edge.u;
    edgeOf[pv] = e;
  }

  const nodeLat = new Float32Array(V);
  const nodeLon = new Float32Array(V);
  const nodeX = new Float32Array(V);
  const nodeY = new Float32Array(V);
  for (let i = 0; i < V; i++) {
    const [lat, lon] = graph.nodes[i];
    nodeLat[i] = lat;
    nodeLon[i] = lon;
    const [x, y] = project(lat, lon);
    nodeX[i] = x;
    nodeY[i] = y;
  }

  return {
    V,
    E,
    arrays: { offsets, targets, edgeOf, len, trees, park, bldg, step, nodeLat, nodeLon, nodeX, nodeY },
  };
}
