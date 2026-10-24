/** Type declarations for the shared binary snapshot format (snapshot-format.mjs). */

export const MAGIC: string;
export const FORMAT_VERSION: number;

export type SnapshotArrays = {
  offsets: Int32Array;
  targets: Int32Array;
  edgeOf: Int32Array;
  len: Float32Array;
  trees: Float32Array;
  park: Float32Array;
  bldg: Float32Array;
  step: Uint8Array;
  nodeLat: Float32Array;
  nodeLon: Float32Array;
  nodeX: Float32Array;
  nodeY: Float32Array;
};

export type DecodedSnapshot = {
  V: number;
  E: number;
  projection: { center: { lat: number; lon: number } };
  arrays: SnapshotArrays;
};

export type EncodeInput = {
  V: number;
  E: number;
  projection: { center: { lat: number; lon: number } };
  arrays: Record<string, ArrayLike<number>>;
};

export function encodeSnapshot(snap: EncodeInput): Buffer;
export function decodeSnapshot(buf: Buffer | Uint8Array): DecodedSnapshot;
