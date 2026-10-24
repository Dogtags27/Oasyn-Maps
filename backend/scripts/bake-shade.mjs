/**
 * bake-shade.mjs — bake the per-edge skyline (horizon.bin) from real building heights.
 *
 * Why: the old shade term counted building centroids near a street and ignored
 * height, street width and sun direction, so most edges read as sunny and the
 * coolest route barely differed from the fastest. This script gives every edge a
 * skyline per compass bin so the runtime can shade streets geometrically.
 *
 * Height sources:
 *   1. City of Boston DOIT_buildings (TOP_GROUND_LEVEL, US feet -> metres). Real
 *      heights for Boston proper. Public domain (PDDL).
 *   2. OSM building footprints already in the snapshot (buildings.json) for the
 *      rest of the bbox (Cambridge, Somerville, Brookline, Chelsea, Everett...).
 *      OSM height tags are too sparse to use, so these get the Boston median
 *      building height as an assumed height.
 *
 * Inputs : the current `latest` snapshot in R2 (graph.json, graph.bin, buildings.json).
 * Outputs: data/horizon.bin + data/meta.json locally; a NEW snapshot version in R2
 *          (all existing objects copied forward + horizon.bin) and the `latest`
 *          pointer advanced last. graph.bin is untouched, so a backend that does
 *          not know about horizon.bin keeps working against the new version.
 *
 * Run: node scripts/bake-shade.mjs [--no-upload] [--refresh]
 *   --no-upload  write local files only, do not touch R2 (reads from R2 still happen)
 *   --refresh    ignore cached downloads in data/.cache
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { r2Client, r2Env, putObject, getObject, getJson } from "./lib/r2.mjs";
import { decodeSnapshot } from "./lib/snapshot-format.mjs";
import { encodeHorizon } from "./lib/horizon-format.mjs";
import { makeProjection } from "./lib/graph-build.mjs";
import { createHeightRaster, fillPolygonMax, fillPolygonGapFill, bakeHorizon } from "./lib/shade-bake.mjs";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, "..", ".env") });

// Mirrors src/config.ts geography (pure Node ESM; keep in sync).
const CONFIG = {
  bbox: { south: 42.231, west: -71.233, north: 42.451, east: -70.935 },
  center: { lat: 42.341, lon: -71.084 },
  snapshotPrefix: "snapshots/inner-metro",
  bostonBuildingsUrl:
    "https://gis.boston.gov/arcgis/rest/services/Assessing/DOIT_buildings/MapServer/2/query",
  bostonWhere: "IEL_TYPE IN ('BLDG','OUTBLDG')",
  bostonPageSize: 2000,
  bostonConcurrency: 4,
  bostonRetries: 4,
  /** envelope padding so shadows from just outside the bbox are not lost (degrees). */
  padDeg: 0.003,
  feetToMetres: 0.3048,
  raster: { cellM: 3, marginM: 250 },
  /** gap-fill skips an OSM footprint if more than this fraction is already covered. */
  maxCoveredFraction: 0.3,
  horizon: {
    bins: 16,
    quantDeg: 0.5,
    sampleStepM: 10,
    maxSamples: 12,
    eyeM: 1.5,
    nearM: 60,
    nearStepM: 3,
    maxRangeM: 150,
    farStepM: 6,
  },
};

const dataDir = join(here, "..", "data");
const cacheDir = join(dataDir, ".cache");
const bostonCachePath = join(cacheDir, "boston-buildings.json");
const graphCachePath = join(cacheDir, "graph.json");
const USER_AGENT = "oasyn-maps-build/0.1 (shade bake; contact: oasyn-maps dev)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const noUpload = process.argv.includes("--no-upload");
const refresh = process.argv.includes("--refresh");

// ---------------------------------------------------------------------------
// Boston building heights (ArcGIS REST, paged)
// ---------------------------------------------------------------------------

function envelope() {
  const b = CONFIG.bbox;
  const p = CONFIG.padDeg;
  return `${b.west - p},${b.south - p},${b.east + p},${b.north + p}`;
}

async function bostonPost(extra) {
  const params = new URLSearchParams({
    where: CONFIG.bostonWhere,
    geometry: envelope(),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    ...extra,
  });
  let lastErr;
  for (let attempt = 1; attempt <= CONFIG.bostonRetries; attempt++) {
    try {
      const res = await fetch(CONFIG.bostonBuildingsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: params.toString(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(`ArcGIS error ${json.error.code}: ${json.error.message}`);
      return json;
    } catch (err) {
      lastErr = err;
      console.warn(`[bake-shade]   boston query failed (#${attempt}): ${err.message}`);
      if (attempt < CONFIG.bostonRetries) await sleep(attempt * 3000);
    }
  }
  throw new Error(`Boston buildings query failed: ${lastErr?.message}`);
}

/** @returns {Promise<{heightFt:number|null,isBldg:boolean,rings:number[][][]}[]>} */
async function loadBostonBuildings() {
  if (!refresh && existsSync(bostonCachePath)) {
    console.log(`[bake-shade] boston buildings: using cache ${bostonCachePath}`);
    return JSON.parse(readFileSync(bostonCachePath, "utf8")).buildings;
  }
  const { count } = await bostonPost({ returnCountOnly: "true", f: "json" });
  const pages = Math.ceil(count / CONFIG.bostonPageSize);
  console.log(`[bake-shade] boston buildings: ${count} in bbox, ${pages} pages x ${CONFIG.bostonPageSize}`);

  const results = new Array(pages);
  let next = 0;
  let done = 0;
  async function worker() {
    for (;;) {
      const p = next++;
      if (p >= pages) return;
      const json = await bostonPost({
        outFields: "IEL_TYPE,TOP_GROUND_LEVEL",
        returnGeometry: "true",
        outSR: "4326",
        geometryPrecision: "6",
        orderByFields: "OBJECTID",
        resultOffset: String(p * CONFIG.bostonPageSize),
        resultRecordCount: String(CONFIG.bostonPageSize),
        f: "geojson",
      });
      const out = [];
      for (const f of json.features ?? []) {
        const g = f.geometry;
        if (!g) continue;
        const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        const top = f.properties?.TOP_GROUND_LEVEL;
        for (const rings of polys) {
          out.push({
            heightFt: typeof top === "number" && Number.isFinite(top) ? top : null,
            isBldg: f.properties?.IEL_TYPE === "BLDG",
            rings,
          });
        }
      }
      results[p] = out;
      done++;
      if (done % 5 === 0 || done === pages) console.log(`[bake-shade]   boston page ${done}/${pages}`);
    }
  }
  await Promise.all(Array.from({ length: CONFIG.bostonConcurrency }, worker));
  const buildings = results.flat();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(bostonCachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), buildings }));
  console.log(`[bake-shade] boston buildings: ${buildings.length} polygons cached`);
  return buildings;
}

function median(sorted) {
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
}

// ---------------------------------------------------------------------------
// R2 inputs
// ---------------------------------------------------------------------------

async function cachedObject(client, bucket, key, path) {
  if (!refresh && existsSync(path)) {
    console.log(`[bake-shade] using cache ${path}`);
    return readFileSync(path);
  }
  console.log(`[bake-shade] downloading r2://${bucket}/${key}`);
  const buf = await getObject(client, bucket, key);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path, buf);
  return buf;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  mkdirSync(cacheDir, { recursive: true });
  const env = r2Env();
  const client = r2Client(env);

  const pointer = await getJson(client, env.bucket, env.latestPointer);
  const srcPrefix = pointer.prefix;
  console.log(`[bake-shade] source snapshot: ${srcPrefix} (version ${pointer.meta.version})`);

  // --- graph (must line up edge-for-edge with graph.bin) -------------------
  const graphKeyed = join(cacheDir, `graph-${pointer.meta.version}.json`);
  const graphBuf = await cachedObject(client, env.bucket, `${srcPrefix}/graph.json`, graphKeyed);
  const graph = JSON.parse(graphBuf.toString("utf8"));
  const binBuf = await getObject(client, env.bucket, `${srcPrefix}/graph.bin`);
  const dec = decodeSnapshot(binBuf);
  if (graph.edges.length !== dec.E) {
    throw new Error(`graph.json has ${graph.edges.length} edges but graph.bin has ${dec.E}`);
  }
  for (let e = 0; e < dec.E; e++) {
    if (Math.abs(graph.edges[e].len - dec.arrays.len[e]) > 0.05) {
      throw new Error(`edge ${e}: graph.json len ${graph.edges[e].len} != graph.bin len ${dec.arrays.len[e]}`);
    }
  }
  console.log(`[bake-shade] graph ok: ${dec.V} nodes, ${dec.E} edges (graph.json matches graph.bin)`);

  // --- heights --------------------------------------------------------------
  const project = makeProjection(CONFIG.center).project;
  const boston = await loadBostonBuildings();

  const heightsM = boston
    .filter((b) => b.isBldg && b.heightFt !== null && b.heightFt > 0)
    .map((b) => b.heightFt * CONFIG.feetToMetres)
    .sort((a, b) => a - b);
  const assumedHeightM = median(heightsM);
  const meanM = heightsM.reduce((s, v) => s + v, 0) / heightsM.length;
  console.log(
    `[bake-shade] boston BLDG heights: n=${heightsM.length} median=${assumedHeightM.toFixed(1)} m ` +
      `mean=${meanM.toFixed(1)} m p90=${heightsM[Math.floor(heightsM.length * 0.9)].toFixed(1)} m ` +
      `-> assumed height for non-Boston buildings = ${assumedHeightM.toFixed(1)} m (median)`,
  );

  // --- raster ---------------------------------------------------------------
  const pad = CONFIG.padDeg;
  const [x0, y0] = project(CONFIG.bbox.south - pad, CONFIG.bbox.west - pad);
  const [x1, y1] = project(CONFIG.bbox.north + pad, CONFIG.bbox.east + pad);
  const m = CONFIG.raster.marginM;
  const raster = createHeightRaster(
    { minX: Math.min(x0, x1) - m, minY: Math.min(y0, y1) - m, maxX: Math.max(x0, x1) + m, maxY: Math.max(y0, y1) + m },
    CONFIG.raster.cellM,
  );
  console.log(`[bake-shade] raster ${raster.w} x ${raster.h} cells @ ${CONFIG.raster.cellM} m (${(raster.data.length / 1e6).toFixed(0)} MB)`);

  const projRings = (rings) => rings.map((ring) => ring.map(([lon, lat]) => project(lat, lon)));

  console.time("[bake-shade] rasterise boston");
  let bostonFilled = 0;
  for (const b of boston) {
    if (b.heightFt === null || b.heightFt <= 0) continue;
    fillPolygonMax(raster, projRings(b.rings), b.heightFt * CONFIG.feetToMetres);
    bostonFilled++;
  }
  console.timeEnd("[bake-shade] rasterise boston");

  const osmBuf = await cachedObject(client, env.bucket, `${srcPrefix}/buildings.json`, join(cacheDir, `buildings-${pointer.meta.version}.json`));
  const osm = JSON.parse(osmBuf.toString("utf8"));
  console.time("[bake-shade] rasterise osm gap-fill");
  const tally = { filled: 0, skipped: 0, tiny: 0 };
  for (const f of osm.features) {
    const rings = f.geometry?.coordinates;
    if (!rings || !rings[0] || rings[0].length < 3) continue;
    tally[fillPolygonGapFill(raster, projRings(rings), assumedHeightM, CONFIG.maxCoveredFraction)]++;
  }
  console.timeEnd("[bake-shade] rasterise osm gap-fill");
  let builtCells = 0;
  for (let i = 0; i < raster.data.length; i++) if (raster.data[i] !== 0) builtCells++;
  console.log(
    `[bake-shade] boston footprints filled=${bostonFilled}; osm filled=${tally.filled} ` +
      `skipped(already covered)=${tally.skipped} tiny=${tally.tiny}; built cells=${(100 * builtCells / raster.data.length).toFixed(1)}%`,
  );

  // --- skyline --------------------------------------------------------------
  console.time("[bake-shade] bake horizon");
  const { data, stats } = bakeHorizon({ graph, project, raster, cfg: CONFIG.horizon });
  console.timeEnd("[bake-shade] bake horizon");
  console.log(
    `[bake-shade] samples=${stats.samples}; inside a footprint=${stats.insideBuilding} ` +
      `(${(100 * stats.insideBuilding / stats.samples).toFixed(1)}%)`,
  );
  const { bins, quantDeg, maxRangeM } = CONFIG.horizon;
  summarise(data, dec.E, bins, quantDeg);

  const horizonBin = encodeHorizon({ E: dec.E, bins, quantDeg, maxRangeM, data });
  console.log(`[bake-shade] horizon.bin ${(horizonBin.length / 1024 / 1024).toFixed(2)} MB`);

  // --- metadata -------------------------------------------------------------
  const retrievedAt = new Date().toISOString();
  const version = retrievedAt.replace(/[:.]/g, "-");
  const heightsLayer = {
    name: "building-heights",
    url: CONFIG.bostonBuildingsUrl.replace("/query", ""),
    retrievedAt,
    kind: "derived",
    notes:
      `Skyline per street edge from building heights. Boston proper: City of Boston DOIT_buildings ` +
      `TOP_GROUND_LEVEL (ft -> m), ${bostonFilled} footprints. Elsewhere: OSM footprints at an assumed ` +
      `${assumedHeightM.toFixed(1)} m (Boston median building height). Terrain and trees not modelled.`,
  };
  const meta = {
    ...pointer.meta,
    version,
    shadeBakedFrom: srcPrefix,
    horizon: { file: "horizon.bin", bins, quantDeg, maxRangeM, assumedHeightM: Number(assumedHeightM.toFixed(2)) },
    layers: [...(pointer.meta.layers ?? []).filter((l) => l?.name !== "building-heights"), heightsLayer],
  };

  // --- local files ----------------------------------------------------------
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "horizon.bin"), horizonBin);
  writeFileSync(join(dataDir, "meta.json"), Buffer.from(JSON.stringify(meta)));
  const localBin = join(dataDir, "graph.bin");
  writeFileSync(localBin, binBuf); // keep the local graph.bin identical to the snapshot the skyline was baked for
  console.log(`[bake-shade] wrote local horizon.bin, meta.json, graph.bin to ${dataDir}`);

  if (noUpload) {
    console.log(`[bake-shade] --no-upload set; skipping R2 publish. (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    return;
  }

  // --- publish (pointer last) -------------------------------------------------
  const prefix = `${CONFIG.snapshotPrefix}/${version}`;
  console.log(`[bake-shade] publishing to r2://${env.bucket}/${prefix}/`);
  await putObject(client, env.bucket, `${prefix}/horizon.bin`, horizonBin, "application/octet-stream");
  await putObject(client, env.bucket, `${prefix}/graph.bin`, binBuf, "application/octet-stream");
  await putObject(client, env.bucket, `${prefix}/graph.json`, graphBuf, "application/json");
  await putObject(client, env.bucket, `${prefix}/buildings.json`, osmBuf, "application/json");
  await putObject(client, env.bucket, `${prefix}/meta.json`, Buffer.from(JSON.stringify(meta)), "application/json");
  for (const name of ["parks.json", "trees.json", "water.json", "places.json", "cooling.json"]) {
    try {
      const buf = await getObject(client, env.bucket, `${srcPrefix}/${name}`);
      await putObject(client, env.bucket, `${prefix}/${name}`, buf, "application/json");
    } catch (err) {
      console.warn(`[bake-shade]   skip copy ${name}: ${err.message}`);
    }
  }
  const ptr = Buffer.from(JSON.stringify({ version, prefix, meta }, null, 2));
  await putObject(client, env.bucket, env.latestPointer, ptr, "application/json");
  console.log(
    `[bake-shade] pointer -> ${env.latestPointer} (version ${version}). Previous version ${pointer.meta.version} ` +
      `is still in R2 at ${srcPrefix} for rollback. Done in ${((Date.now() - t0) / 1000).toFixed(0)} s.`,
  );
}

/** Print a compact distribution of the baked skyline so a bad bake is obvious. */
function summarise(data, E, bins, quantDeg) {
  const mean = new Float64Array(E);
  for (let e = 0; e < E; e++) {
    let s = 0;
    for (let k = 0; k < bins; k++) s += data[e * bins + k];
    mean[e] = (s / bins) * quantDeg;
  }
  const sorted = Float64Array.from(mean).sort();
  const q = (p) => sorted[Math.min(E - 1, Math.floor(E * p))].toFixed(1);
  console.log(`[bake-shade] mean skyline elevation per edge (deg): p10=${q(0.1)} p25=${q(0.25)} p50=${q(0.5)} p75=${q(0.75)} p90=${q(0.9)} p99=${q(0.99)}`);
}

main().catch((err) => {
  console.error(`[bake-shade] failed: ${err.message}`);
  process.exitCode = 1;
});
