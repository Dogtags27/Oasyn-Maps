/**
 * core/turns.ts — turn instructions from a node path (R6.7).
 *
 * A turn is emitted where the bearing changes by more than a threshold, as a
 * descriptor (never a sentence). Street names are not carried in the CSR
 * snapshot's node arrays, so turns here are bearing-based; name-change turns can
 * be layered in once edge names are threaded through (kept simple for the MVP).
 */

import type { LatLng, Turn } from "../../contract/schemas.js";
import type { PlanContext } from "./types.js";
import { turns as turnCfg } from "../config.js";
import { turnArrive, turnDepart, turnLeft, turnRight, turnSlightLeft, turnSlightRight } from "./descriptors.js";

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Initial bearing (degrees, 0=N clockwise) from point a to b. */
function bearing(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Signed bearing delta in (-180, 180]; positive = right turn. */
function signedDelta(from: number, to: number): number {
  let d = (to - from + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

/** Build turn descriptors along a node path. */
export function turnsFor(ctx: PlanContext, nodes: number[]): Turn[] {
  const { snap } = ctx;
  const at = (n: number): LatLng => ({ lat: snap.nodeLat[n]!, lng: snap.nodeLon[n]! });
  const out: Turn[] = [];
  if (nodes.length < 2) return out;

  out.push({ at: at(nodes[0]!), descriptor: turnDepart(), bearingDelta: 0 });

  let prevBearing = bearing(
    snap.nodeLat[nodes[0]!]!,
    snap.nodeLon[nodes[0]!]!,
    snap.nodeLat[nodes[1]!]!,
    snap.nodeLon[nodes[1]!]!,
  );

  for (let i = 1; i < nodes.length - 1; i++) {
    const a = nodes[i]!;
    const b = nodes[i + 1]!;
    const br = bearing(snap.nodeLat[a]!, snap.nodeLon[a]!, snap.nodeLat[b]!, snap.nodeLon[b]!);
    const delta = signedDelta(prevBearing, br);
    const mag = Math.abs(delta);
    if (mag >= turnCfg.straightDeg) {
      const right = delta > 0;
      let desc;
      if (mag >= turnCfg.sharpDeg) desc = right ? turnRight() : turnLeft();
      else desc = right ? turnSlightRight() : turnSlightLeft();
      out.push({ at: at(a), descriptor: desc, bearingDelta: Math.round(delta) });
    }
    prevBearing = br;
  }

  out.push({ at: at(nodes[nodes.length - 1]!), descriptor: turnArrive(), bearingDelta: 0 });
  return out;
}
