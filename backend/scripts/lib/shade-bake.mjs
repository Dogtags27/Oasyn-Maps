/**
 * shade-bake.mjs — building height raster and per-edge skyline bake.
 *
 * Pure functions (no I/O). Pipeline:
 *   1. createHeightRaster      metre-grid over the projected bbox, Uint8 heights.
 *   2. fillPolygonsMax /       rasterise building footprints (authoritative
 *      fillPolygonsGapFill     heights win; gap-fill adds the rest at an assumed
 *                              height without doubling up on covered buildings).
 *   3. bakeHorizon             for samples along every edge, scan outward in
 *                              `bins` compass directions and record the highest
 *                              skyline elevation angle; average over samples.
 *
 * Everything is deterministic: fixed sample positions, fixed scan distances.
 */

const RAD2DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Height raster
// ---------------------------------------------------------------------------

/** @param {{minX:number,minY:number,maxX:number,maxY:number}} bounds projected metres */
export function createHeightRaster(bounds, cellM) {
  const w = Math.ceil((bounds.maxX - bounds.minX) / cellM);
  const h = Math.ceil((bounds.maxY - bounds.minY) / cellM);
  return { minX: bounds.minX, minY: bounds.minY, cellM, w, h, data: new Uint8Array(w * h) };
}

/**
 * Scanline-fill a polygon (all rings, even-odd so holes work) and call
 * fn(startIdx, endIdx) for each horizontal run of covered cells.
 * `rings` are arrays of [x, y] in projected metres.
 */
function forEachRun(raster, rings, fn) {
  const { minX, minY, cellM, w, h } = raster;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p[1] < ymin) ymin = p[1];
      if (p[1] > ymax) ymax = p[1];
    }
  }
  const r0 = Math.max(0, Math.floor((ymin - minY) / cellM));
  const r1 = Math.min(h - 1, Math.floor((ymax - minY) / cellM));
  const xs = [];
  for (let r = r0; r <= r1; r++) {
    const yc = minY + (r + 0.5) * cellM;
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const yi = ring[i][1];
        const yj = ring[j][1];
        if (yi <= yc !== yj <= yc) {
          xs.push(ring[i][0] + ((yc - yi) * (ring[j][0] - ring[i][0])) / (yj - yi));
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let c0 = Math.ceil((xs[k] - minX) / cellM - 0.5);
      let c1 = Math.floor((xs[k + 1] - minX) / cellM - 0.5);
      if (c0 < 0) c0 = 0;
      if (c1 > w - 1) c1 = w - 1;
      if (c1 >= c0) fn(r * w + c0, r * w + c1);
    }
  }
}

const toHeightByte = (m) => Math.max(1, Math.min(255, Math.round(m)));

/** Rasterise a footprint at height heightM; where footprints overlap, the taller wins. */
export function fillPolygonMax(raster, rings, heightM) {
  const hv = toHeightByte(heightM);
  const { data } = raster;
  forEachRun(raster, rings, (a, b) => {
    for (let i = a; i <= b; i++) if (data[i] < hv) data[i] = hv;
  });
}

/**
 * Rasterise a footprint only if it is not already mostly covered by authoritative
 * footprints (skips the OSM twin of a Boston building so a few metres of
 * registration offset do not grow phantom slivers). Fills empty cells only.
 * @returns {"filled"|"skipped"|"tiny"}
 */
export function fillPolygonGapFill(raster, rings, heightM, maxCoveredFraction) {
  const hv = toHeightByte(heightM);
  const { data } = raster;
  let total = 0;
  let covered = 0;
  forEachRun(raster, rings, (a, b) => {
    total += b - a + 1;
    for (let i = a; i <= b; i++) if (data[i] !== 0) covered++;
  });
  if (total === 0) return "tiny";
  if (covered / total > maxCoveredFraction) return "skipped";
  forEachRun(raster, rings, (a, b) => {
    for (let i = a; i <= b; i++) if (data[i] === 0) data[i] = hv;
  });
  return "filled";
}

// ---------------------------------------------------------------------------
// Skyline bake
// ---------------------------------------------------------------------------

/** Scan distances (m): fine near the street where shadows start, coarser far out. */
function scanDistances(cellM, nearM, nearStepM, maxM, farStepM) {
  const out = [];
  for (let d = cellM; d <= nearM; d += nearStepM) out.push(d);
  for (let d = nearM + farStepM; d <= maxM; d += farStepM) out.push(d);
  return Float64Array.from(out);
}

/**
 * Sample positions along an edge polyline (projected), at the midpoints of n
 * equal sections so junction corners are not over-weighted.
 */
function samplePolyline(xy, n, out) {
  let total = 0;
  const seg = [];
  for (let i = 0; i + 1 < xy.length; i++) {
    const l = Math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]);
    seg.push(l);
    total += l;
  }
  out.length = 0;
  if (total === 0) {
    out.push(xy[0][0], xy[0][1]);
    return;
  }
  let si = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = ((k + 0.5) / n) * total;
    while (si < seg.length - 1 && acc + seg[si] < target) {
      acc += seg[si];
      si++;
    }
    const t = seg[si] === 0 ? 0 : (target - acc) / seg[si];
    out.push(
      xy[si][0] + (xy[si + 1][0] - xy[si][0]) * t,
      xy[si][1] + (xy[si + 1][1] - xy[si][1]) * t,
    );
  }
}

/**
 * Bake the skyline for every edge.
 *
 * @param {object} p
 * @param {{edges:{geom:number[][]}[]}} p.graph      edges with geom [[lat,lon],...]
 * @param {(lat:number,lon:number)=>number[]} p.project
 * @param {ReturnType<typeof createHeightRaster>} p.raster
 * @param {{bins:number,quantDeg:number,sampleStepM:number,maxSamples:number,
 *          eyeM:number,nearM:number,nearStepM:number,maxRangeM:number,farStepM:number}} p.cfg
 * @returns {{data:Uint8Array, stats:{samples:number,insideBuilding:number}}}
 */
export function bakeHorizon({ graph, project, raster, cfg }) {
  const { bins, quantDeg, sampleStepM, maxSamples, eyeM, maxRangeM } = cfg;
  const E = graph.edges.length;
  const out = new Uint8Array(E * bins);

  const dist = scanDistances(raster.cellM, cfg.nearM, cfg.nearStepM, maxRangeM, cfg.farStepM);
  const nd = dist.length;
  const sinB = new Float64Array(bins);
  const cosB = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    const b = (k * 2 * Math.PI) / bins; // bearing, clockwise from north
    sinB[k] = Math.sin(b);
    cosB[k] = Math.cos(b);
  }

  const { data, minX, minY, w, h } = raster;
  const inv = 1 / raster.cellM;
  const maxByte = Math.round(90 / quantDeg);
  const sums = new Float64Array(bins);
  const pts = [];
  let samples = 0;
  let insideBuilding = 0;

  for (let e = 0; e < E; e++) {
    const geom = graph.edges[e].geom;
    const xy = geom.map(([lat, lon]) => project(lat, lon));
    let length = 0;
    for (let i = 0; i + 1 < xy.length; i++) {
      length += Math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]);
    }
    const n = Math.max(1, Math.min(maxSamples, Math.ceil(length / sampleStepM)));
    samplePolyline(xy, n, pts);
    const count = pts.length / 2;
    sums.fill(0);

    for (let s = 0; s < count; s++) {
      const x = pts[2 * s];
      const y = pts[2 * s + 1];
      samples++;

      // A sample that falls inside a footprint (arcade, passage, courtyard way) is covered.
      const cx = Math.floor((x - minX) * inv);
      const cy = Math.floor((y - minY) * inv);
      if (cx >= 0 && cy >= 0 && cx < w && cy < h && data[cy * w + cx] > eyeM) {
        insideBuilding++;
        for (let k = 0; k < bins; k++) sums[k] += 90;
        continue;
      }

      for (let k = 0; k < bins; k++) {
        const dx = sinB[k];
        const dy = cosB[k];
        let best = 0; // max tan(elevation)
        for (let di = 0; di < nd; di++) {
          const d = dist[di];
          const px = x + dx * d;
          const py = y + dy * d;
          if (px < minX || py < minY) break;
          const ix = ((px - minX) * inv) | 0;
          const iy = ((py - minY) * inv) | 0;
          if (ix >= w || iy >= h) break;
          const hh = data[iy * w + ix];
          if (hh > eyeM) {
            const t = (hh - eyeM) / d;
            if (t > best) best = t;
          }
        }
        sums[k] += Math.atan(best) * RAD2DEG;
      }
    }

    const base = e * bins;
    for (let k = 0; k < bins; k++) {
      const v = Math.round(sums[k] / count / quantDeg);
      out[base + k] = v > maxByte ? maxByte : v;
    }
  }
  return { data: out, stats: { samples, insideBuilding } };
}
