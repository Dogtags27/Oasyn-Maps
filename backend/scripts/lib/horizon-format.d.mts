/** Type declarations for the baked skyline format (horizon-format.mjs). */
export const HZ_MAGIC: string;
export const HZ_VERSION: number;
export type HorizonData = {
  E: number;
  bins: number;
  /** degrees per stored unit. */
  quantDeg: number;
  /** how far the skyline scan looked, metres. */
  maxRangeM: number;
  data: Uint8Array;
};
export function encodeHorizon(h: HorizonData): Buffer;
export function decodeHorizon(buf: Buffer | Uint8Array): HorizonData;
