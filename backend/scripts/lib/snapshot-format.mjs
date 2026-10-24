/**
 * snapshot-format.mjs — the compact BINARY CSR snapshot format.
 *
 * Why binary: at inner-metro scale the graph is ~170 MB as JSON and parsing it
 * at every server boot is seconds of CPU and a transient 2-3x memory spike. The
 * binary format is loaded by creating typed-array VIEWS over the downloaded
 * buffer — effectively zero parse cost — so startup stays fast (design §8.4/§14).
 *
 * This module is the single source of truth for the layout, imported by both
 * the writer (build-data.mjs, Node ESM) and the reader (src/snapshot.ts, TS).
 *
 * Layout (little-endian throughout):
 *   [0..4)    magic   "OSNP"  (4 bytes)
 *   [4..8)    uint32  format version
 *   [8..12)   uint32  header JSON byte length  (H)
 *   [12..12+H) header JSON (utf8): counts, projection, section byte offsets/lengths
 *   [align 8] then each section's bytes, in the order listed in header.sections,
 *             each section 8-byte aligned so TypedArray views are valid.
 *
 * CSR graph (undirected stored as directed both ways):
 *   offsets   Int32Array (V+1)      neighbour-list start per node
 *   targets   Int32Array (2E)       neighbour node id
 *   edgeOf    Int32Array (2E)       edge id for each directed arc
 *   len       Float32Array (E)      edge length, metres
 *   trees     Float32Array (E)      baked canopy feature (count within radius)
 *   park      Float32Array (E)      baked park fraction [0,1]
 *   bldg      Float32Array (E)      baked building-proximity count
 *   step      Uint8Array  (E)       1 = stairs / wheelchair=no
 *   nodeLat   Float32Array (V)      node latitude
 *   nodeLon   Float32Array (V)      node longitude
 *   nodeX     Float32Array (V)      projected x (metres, equirectangular)
 *   nodeY     Float32Array (V)      projected y (metres)
 *
 * `heat` and `safety` are NOT stored: they are runtime arrays recomputed per
 * scenario (R15.3), allocated once at load.
 */

export const MAGIC = "OSNP";
export const FORMAT_VERSION = 1;

/** Section descriptors: name -> typed-array ctor and element count expression. */
export const SECTIONS = [
  { name: "offsets", ctor: Int32Array, count: (c) => c.V + 1 },
  { name: "targets", ctor: Int32Array, count: (c) => 2 * c.E },
  { name: "edgeOf", ctor: Int32Array, count: (c) => 2 * c.E },
  { name: "len", ctor: Float32Array, count: (c) => c.E },
  { name: "trees", ctor: Float32Array, count: (c) => c.E },
  { name: "park", ctor: Float32Array, count: (c) => c.E },
  { name: "bldg", ctor: Float32Array, count: (c) => c.E },
  { name: "step", ctor: Uint8Array, count: (c) => c.E },
  { name: "nodeLat", ctor: Float32Array, count: (c) => c.V },
  { name: "nodeLon", ctor: Float32Array, count: (c) => c.V },
  { name: "nodeX", ctor: Float32Array, count: (c) => c.V },
  { name: "nodeY", ctor: Float32Array, count: (c) => c.V },
];

const align8 = (n) => (n + 7) & ~7;

/**
 * Encode CSR arrays to a single Buffer.
 * @param {{V:number,E:number,projection:object,arrays:Record<string,ArrayLike<number>>}} snap
 * @returns {Buffer}
 */
export function encodeSnapshot(snap) {
  const { V, E, projection, arrays } = snap;
  const counts = { V, E };

  // Compute section byte layout.
  const sections = [];
  let cursor = 0;
  for (const s of SECTIONS) {
    const n = s.count(counts);
    const bytes = n * s.ctor.BYTES_PER_ELEMENT;
    sections.push({ name: s.name, byteOffset: cursor, byteLength: bytes, count: n });
    cursor = align8(cursor + bytes);
  }
  const bodyBytes = cursor;

  const headerObj = { V, E, projection, sections };
  const headerJson = Buffer.from(JSON.stringify(headerObj), "utf8");
  const headerLen = headerJson.length;

  const preamble = 12; // magic(4) + version(4) + headerLen(4)
  const bodyStart = align8(preamble + headerLen);
  const total = bodyStart + bodyBytes;

  const buf = Buffer.alloc(total);
  buf.write(MAGIC, 0, "ascii");
  buf.writeUInt32LE(FORMAT_VERSION, 4);
  buf.writeUInt32LE(headerLen, 8);
  headerJson.copy(buf, 12);

  // Write each section's typed array into the body.
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    const meta = sections[i];
    const src = arrays[s.name];
    if (!src || src.length !== meta.count) {
      throw new Error(
        `snapshot encode: section ${s.name} expected ${meta.count} elements, got ${src ? src.length : "undefined"}`,
      );
    }
    const view = new s.ctor(buf.buffer, buf.byteOffset + bodyStart + meta.byteOffset, meta.count);
    view.set(src);
  }
  return buf;
}

/**
 * Decode a Buffer into CSR typed-array views (zero-copy over the buffer).
 * @param {Buffer|Uint8Array} buf
 * @returns {{V:number,E:number,projection:object,arrays:Record<string,any>}}
 */
export function decodeSnapshot(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== MAGIC) throw new Error(`snapshot: bad magic '${magic}' (expected ${MAGIC})`);
  const version = dv.getUint32(4, true);
  if (version !== FORMAT_VERSION) {
    throw new Error(`snapshot: unsupported format version ${version} (expected ${FORMAT_VERSION})`);
  }
  const headerLen = dv.getUint32(8, true);
  const headerJson = Buffer.from(u8.buffer, u8.byteOffset + 12, headerLen).toString("utf8");
  const header = JSON.parse(headerJson);

  const preamble = 12;
  const bodyStart = align8(preamble + headerLen);

  const ctorByName = Object.fromEntries(SECTIONS.map((s) => [s.name, s.ctor]));
  const arrays = {};
  for (const sec of header.sections) {
    const Ctor = ctorByName[sec.name];
    if (!Ctor) throw new Error(`snapshot: unknown section '${sec.name}'`);
    arrays[sec.name] = new Ctor(
      u8.buffer,
      u8.byteOffset + bodyStart + sec.byteOffset,
      sec.count,
    );
  }
  return { V: header.V, E: header.E, projection: header.projection, arrays };
}
