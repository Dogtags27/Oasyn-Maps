/**
 * build-data.mjs — data snapshot build + publish (requirement R2).
 *
 * Pipeline:
 *   1. Tile the inner-metro bbox (600 km^2) into a grid; a single Overpass call
 *      for the whole area times out, so each tile is fetched separately with
 *      mirror fallback + retry, then merged (deduping OSM elements by id).
 *   2. Partition into layers; build the raw undirected graph (dedupe nodes by
 *      rounded coordinate).
 *   3. VALIDATION GATE: node/edge counts, non-empty layers, and largest-
 *      connected-component coverage must pass, else the build fails loudly and
 *      does NOT publish (guards against Overpass silent-partial-success).
 *   4. Write the snapshot locally (data/), then publish to Cloudflare R2 under a
 *      versioned key and advance the `latest` pointer only after validation.
 *
 * Feature baking (25 m grid hash) and degree-2 contraction land in Hour 2
 * (task 7); graph features default to 0 here.
 *
 * Run manually: `node scripts/build-data.mjs`
 *   Flags: --no-upload   build + validate locally, skip R2 publish.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { r2Client, r2Env, putObject } from "./lib/r2.mjs";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, "..", ".env") });

// Values mirrored from src/config.ts (kept pure Node ESM; keep in sync).
const CONFIG = {
  // Inner-metro bbox, ~600 km^2 centered on (42.341, -71.084).
  bbox: { south: 42.231, west: -71.233, north: 42.451, east: -70.935 },
  overpassPrimary: "https://overpass-api.de/api/interpreter",
  overpassMirror: "https://overpass.kumi.systems/api/interpreter",
  coolingCentersUrl:
    "https://gis.boston.gov/arcgis/rest/services/StoryMaps/CoolingCenters/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson",
  coordRound: 6, // decimals for node dedupe
  tiles: 4, // 4x4 grid = 16 tiles
  tileRetries: 3,
  tileBackoffMs: 5000,
  validate: {
    minNodes: 150_000,
    minEdges: 180_000,
    minTreeFeatures: 5_000,
    minParkFeatures: 50,
    minConnectedFraction: 0.8,
  },
  snapshotPrefix: "snapshots/inner-metro",
};

const dataDir = join(here, "..", "data");
const USER_AGENT = "oasyn-maps-build/0.1 (snapshot build; contact: oasyn-maps dev)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Tiling
// ---------------------------------------------------------------------------

function tileBboxes(bbox, n) {
  const tiles = [];
  const dLat = (bbox.north - bbox.south) / n;
  const dLon = (bbox.east - bbox.west) / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      tiles.push({
        south: bbox.south + i * dLat,
        north: bbox.south + (i + 1) * dLat,
        west: bbox.west + j * dLon,
        east: bbox.west + (j + 1) * dLon,
      });
    }
  }
  return tiles;
}

function overpassQuery(bbox) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `
    [out:json][timeout:90];
    (
      way["highway"]["highway"!~"motorway|trunk|construction|proposed"](${b});
      way["leisure"="park"](${b});
      relation["leisure"="park"](${b});
      node["natural"="tree"](${b});
      way["building"](${b});
      node["amenity"="drinking_water"](${b});
      node["place"](${b});
    );
    out body geom;
  `;
}

// ---------------------------------------------------------------------------
// Overpass fetch: per tile, mirror fallback + retry (R2.4)
// ---------------------------------------------------------------------------

async function fetchTile(bbox, label) {
  const body = new URLSearchParams({ data: overpassQuery(bbox) }).toString();
  const endpoints = [CONFIG.overpassPrimary, CONFIG.overpassMirror];
  let lastErr;
  for (const url of endpoints) {
    for (let attempt = 1; attempt <= CONFIG.tileRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": USER_AGENT,
          },
          body,
        });
        if (res.status === 429 || res.status === 504) {
          throw new Error(`HTTP ${res.status} (retryable)`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return { elements: json.elements ?? [], url };
      } catch (err) {
        lastErr = err;
        console.warn(`[build-data]   ${label} failed (${url} #${attempt}): ${err.message}`);
        if (attempt < CONFIG.tileRetries) await sleep(attempt * CONFIG.tileBackoffMs);
      }
    }
  }
  throw new Error(`Tile ${label} failed on all endpoints: ${lastErr?.message ?? "unknown"}`);
}

async function fetchAllTiles(bbox) {
  const tiles = tileBboxes(bbox, CONFIG.tiles);
  console.log(`[build-data] fetching ${tiles.length} tiles (${CONFIG.tiles}x${CONFIG.tiles})`);
  const byId = new Map(); // dedupe merged elements across tile seams by type/id
  let usedUrl = CONFIG.overpassPrimary;
  for (let t = 0; t < tiles.length; t++) {
    const label = `tile ${t + 1}/${tiles.length}`;
    const { elements, url } = await fetchTile(tiles[t], label);
    usedUrl = url;
    for (const el of elements) byId.set(`${el.type}/${el.id}`, el);
    console.log(`[build-data]   ${label} ok (${elements.length} elements, running unique=${byId.size})`);
  }
  return { elements: [...byId.values()], url: usedUrl };
}

async function fetchCoolingCenters() {
  try {
    console.log(`[build-data] cooling centers -> GIS`);
    const res = await fetch(CONFIG.coolingCentersUrl, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[build-data] cooling-center fetch failed: ${err.message}`);
    return { type: "FeatureCollection", features: [] };
  }
}

// ---------------------------------------------------------------------------
// Partition + graph build
// ---------------------------------------------------------------------------

function partition(elements) {
  const ways = [], parks = [], trees = [], buildings = [], water = [], places = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === "way" && tags.highway) ways.push(el);
    else if ((el.type === "way" || el.type === "relation") && tags.leisure === "park") parks.push(el);
    else if (el.type === "node" && tags.natural === "tree") trees.push(el);
    else if (el.type === "way" && tags.building) buildings.push(el);
    else if (el.type === "node" && tags.amenity === "drinking_water") water.push(el);
    else if (el.type === "node" && tags.place) places.push(el);
  }
  return { ways, parks, trees, buildings, water, places };
}

function haversineM(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function buildRawGraph(ways) {
  const key = (lat, lon) => `${lat.toFixed(CONFIG.coordRound)},${lon.toFixed(CONFIG.coordRound)}`;
  const nodeId = new Map();
  const nodes = [];
  const edges = [];
  const idOf = (lat, lon) => {
    const k = key(lat, lon);
    let id = nodeId.get(k);
    if (id === undefined) {
      id = nodes.length;
      nodes.push([lat, lon]);
      nodeId.set(k, id);
    }
    return id;
  };
  for (const way of ways) {
    const geom = way.geometry;
    if (!geom || geom.length < 2) continue;
    const tags = way.tags ?? {};
    const kind = tags.highway ?? "path";
    const name = tags.name;
    const step = tags.highway === "steps" || tags.wheelchair === "no";
    for (let i = 0; i < geom.length - 1; i++) {
      const a = geom[i];
      const b = geom[i + 1];
      if (!a || !b) continue;
      const u = idOf(a.lat, a.lon);
      const v = idOf(b.lat, b.lon);
      if (u === v) continue;
      const len = haversineM({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
      edges.push({
        u, v, len, name, kind, step,
        trees: 0, park: 0, bldg: 0,
        geom: [[a.lat, a.lon], [b.lat, b.lon]],
      });
    }
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Connectivity: largest connected component as a fraction of all nodes
// ---------------------------------------------------------------------------

function largestComponentFraction(graph) {
  const n = graph.nodes.length;
  if (n === 0) return 0;
  const adj = Array.from({ length: n }, () => []);
  for (const e of graph.edges) {
    adj[e.u].push(e.v);
    adj[e.v].push(e.u);
  }
  const seen = new Uint8Array(n);
  let best = 0;
  const stack = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    let size = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const u = stack.pop();
      size++;
      for (const v of adj[u]) if (!seen[v]) { seen[v] = 1; stack.push(v); }
    }
    if (size > best) best = size;
  }
  return best / n;
}

// ---------------------------------------------------------------------------
// Validation gate (R2): fail loudly, never publish partial data
// ---------------------------------------------------------------------------

function validate(graph, layers) {
  const v = CONFIG.validate;
  const connected = largestComponentFraction(graph);
  const checks = [
    [graph.nodes.length >= v.minNodes, `nodes ${graph.nodes.length} >= ${v.minNodes}`],
    [graph.edges.length >= v.minEdges, `edges ${graph.edges.length} >= ${v.minEdges}`],
    [layers.trees.features.length >= v.minTreeFeatures, `trees ${layers.trees.features.length} >= ${v.minTreeFeatures}`],
    [layers.parks.features.length >= v.minParkFeatures, `parks ${layers.parks.features.length} >= ${v.minParkFeatures}`],
    [connected >= v.minConnectedFraction, `connected ${(connected * 100).toFixed(1)}% >= ${(v.minConnectedFraction * 100).toFixed(0)}%`],
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  for (const [ok, msg] of checks) console.log(`[build-data]   ${ok ? "PASS" : "FAIL"} ${msg}`);
  if (failed.length) {
    throw new Error(`Validation gate failed (${failed.length}): ${failed.join("; ")}. Not publishing.`);
  }
  return { connected };
}

// ---------------------------------------------------------------------------
// GeoJSON serialisation
// ---------------------------------------------------------------------------

function nodesToPoints(list, kind) {
  return {
    type: "FeatureCollection",
    features: list.map((n) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [n.lon, n.lat] },
      properties: { id: `${n.type}/${n.id}`, kind, name: n.tags?.name, status: "unknown" },
    })),
  };
}

function waysToPolys(list, kind) {
  return {
    type: "FeatureCollection",
    features: list
      .filter((w) => w.geometry && w.geometry.length >= 3)
      .map((w) => ({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [w.geometry.map((p) => [p.lon, p.lat])] },
        properties: { id: `${w.type}/${w.id}`, kind, name: w.tags?.name },
      })),
  };
}

// ---------------------------------------------------------------------------
// R2 publish
// ---------------------------------------------------------------------------

async function publish(version, files, meta) {
  const env = r2Env();
  const client = r2Client(env);
  const prefix = `${CONFIG.snapshotPrefix}/${version}`;
  console.log(`[build-data] publishing to r2://${env.bucket}/${prefix}/`);
  for (const [name, buf] of files) {
    await putObject(client, env.bucket, `${prefix}/${name}`, buf, "application/json");
    console.log(`[build-data]   put ${name} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  }
  // Advance the latest pointer only after every object uploaded.
  const pointer = Buffer.from(JSON.stringify({ version, prefix, meta }, null, 2));
  await putObject(client, env.bucket, env.latestPointer, pointer, "application/json");
  console.log(`[build-data]   pointer -> ${env.latestPointer} (version ${version})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const noUpload = process.argv.includes("--no-upload");
  mkdirSync(dataDir, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const version = retrievedAt.replace(/[:.]/g, "-");

  const { elements, url } = await fetchAllTiles(CONFIG.bbox);
  const { ways, parks, trees, buildings, water, places } = partition(elements);
  const cooling = await fetchCoolingCenters();

  const graph = buildRawGraph(ways);
  console.log(`[build-data] raw graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  const layers = {
    parks: waysToPolys(parks, "park"),
    trees: nodesToPoints(trees, "tree"),
    water: nodesToPoints(water, "water"),
    places: nodesToPoints(places, "place"),
    buildings: waysToPolys(buildings, "building"),
    cooling,
  };

  // Validation gate — throws (non-zero exit) before any publish on failure.
  const { connected } = validate(graph, layers);

  const meta = {
    contractVersion: "0.1.0",
    version,
    bbox: CONFIG.bbox,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    connectedFraction: Number(connected.toFixed(4)),
    layers: [
      layerProv("graph", url, retrievedAt, "derived", "Raw undirected walking graph; degree-2 contraction pending (Hour 2)."),
      layerProv("parks", url, retrievedAt, "real", "OSM leisure=park."),
      layerProv("trees", url, retrievedAt, "real", "OSM natural=tree."),
      layerProv("water", url, retrievedAt, "real", "OSM amenity=drinking_water."),
      layerProv("places", url, retrievedAt, "real", "OSM place nodes."),
      layerProv("buildings", url, retrievedAt, "real", "OSM building footprints (for shade baking)."),
      layerProv("cooling", CONFIG.coolingCentersUrl, retrievedAt, "real", "GIS cooling centers; status unknown unless source states otherwise (R2.7)."),
    ],
  };

  // Serialise once; reuse the buffers for both local write and R2 upload.
  const files = [
    ["graph.json", Buffer.from(JSON.stringify(graph))],
    ["parks.json", Buffer.from(JSON.stringify(layers.parks))],
    ["trees.json", Buffer.from(JSON.stringify(layers.trees))],
    ["water.json", Buffer.from(JSON.stringify(layers.water))],
    ["places.json", Buffer.from(JSON.stringify(layers.places))],
    ["buildings.json", Buffer.from(JSON.stringify(layers.buildings))],
    ["cooling.json", Buffer.from(JSON.stringify(layers.cooling))],
    ["meta.json", Buffer.from(JSON.stringify(meta))],
  ];
  for (const [name, buf] of files) writeFileSync(join(dataDir, name), buf);
  console.log(`[build-data] wrote local snapshot to ${dataDir}`);

  if (noUpload) {
    console.log(`[build-data] --no-upload set; skipping R2 publish.`);
    return;
  }
  await publish(version, files, meta);
  console.log(`[build-data] done.`);
}

function layerProv(name, url, retrievedAt, kind, notes) {
  return { name, url, retrievedAt, kind, notes };
}

main().catch((err) => {
  console.error(`[build-data] failed: ${err.message}`);
  process.exitCode = 1;
});
