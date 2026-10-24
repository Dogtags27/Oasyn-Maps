/**
 * horizon-format.mjs — the baked per-edge skyline ("horizon.bin").
 *
 * For every edge and every compass bin it stores the mean elevation angle of the
 * skyline (nearby buildings) as seen from the street, quantised to Uint8. The
 * runtime shades an edge when the sun is below that skyline in the sun's
 * direction (see core/env.ts buildHeatArray).
 *
 * It is a SEPARATE object next to graph.bin, so graph.bin keeps format v1 and a
 * backend that does not know about the horizon keeps working against the same
 * snapshot version.
 *
 * Layout (little-endian):
 *   [0..4)    magic "OSHZ"
 *   [4..8)    uint32 format version
 *   [8..12)   uint32 E            edge count (must match graph.bin)
 *   [12..16)  uint32 bins         compass bins; bin k looks along bearing k*360/bins
 *   [16..20)  uint32 quantMilliDeg  degrees per stored unit, x1000 (500 = 0.5 deg)
 *   [20..24)  uint32 maxRangeM    how far the skyline scan looked, metres
 *   [24..)    Uint8 data, E * bins, edge-major (edge e, bin k at e*bins + k)
 */

export const HZ_MAGIC = "OSHZ";
export const HZ_VERSION = 1;
const HEADER_BYTES = 24;

/**
 * @param {{E:number,bins:number,quantDeg:number,maxRangeM:number,data:Uint8Array}} h
 * @returns {Buffer}
 */
export function encodeHorizon(h) {
  const { E, bins, quantDeg, maxRangeM, data } = h;
  if (data.length !== E * bins) {
    throw new Error(`horizon encode: expected ${E * bins} bytes, got ${data.length}`);
  }
  const buf = Buffer.alloc(HEADER_BYTES + data.length);
  buf.write(HZ_MAGIC, 0, "ascii");
  buf.writeUInt32LE(HZ_VERSION, 4);
  buf.writeUInt32LE(E, 8);
  buf.writeUInt32LE(bins, 12);
  buf.writeUInt32LE(Math.round(quantDeg * 1000), 16);
  buf.writeUInt32LE(Math.round(maxRangeM), 20);
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(buf, HEADER_BYTES);
  return buf;
}

/**
 * Decode into a Uint8Array view over the buffer (zero copy).
 * @param {Buffer|Uint8Array} buf
 * @returns {{E:number,bins:number,quantDeg:number,maxRangeM:number,data:Uint8Array}}
 */
export function decodeHorizon(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8.length < HEADER_BYTES) throw new Error("horizon: truncated header");
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== HZ_MAGIC) throw new Error(`horizon: bad magic '${magic}' (expected ${HZ_MAGIC})`);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const version = dv.getUint32(4, true);
  if (version !== HZ_VERSION) throw new Error(`horizon: unsupported version ${version}`);
  const E = dv.getUint32(8, true);
  const bins = dv.getUint32(12, true);
  const quantDeg = dv.getUint32(16, true) / 1000;
  const maxRangeM = dv.getUint32(20, true);
  const n = E * bins;
  if (u8.length < HEADER_BYTES + n) throw new Error("horizon: truncated data");
  return { E, bins, quantDeg, maxRangeM, data: new Uint8Array(u8.buffer, u8.byteOffset + HEADER_BYTES, n) };
}
