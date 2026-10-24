/**
 * core/descriptors.ts — typed helpers that build Descriptor { key, vars }.
 *
 * All user-facing text crosses the API as descriptors, never sentences (R13.4).
 * Every key here must exist in contract/messages.json (contract.test enforces).
 * Centralising construction keeps keys consistent and greppable.
 */

import type { Descriptor } from "../../contract/schemas.js";

export function d(key: string, vars?: Descriptor["vars"]): Descriptor {
  return vars && Object.keys(vars).length ? { key, vars } : { key };
}

// --- turns -----------------------------------------------------------------
export const turnDepart = (street?: string) => d("turn.depart", street ? { street } : {});
export const turnArrive = () => d("turn.arrive");
export const turnStraight = () => d("turn.straight");
export const turnLeft = (street?: string) => d("turn.left", street ? { street } : {});
export const turnRight = (street?: string) => d("turn.right", street ? { street } : {});
export const turnSlightLeft = (street?: string) => d("turn.slightLeft", street ? { street } : {});
export const turnSlightRight = (street?: string) => d("turn.slightRight", street ? { street } : {});

// --- explanations ----------------------------------------------------------
export const explShadeDiff = (pct: number) => d("route.explain.shadeDiff", { pct: Math.round(pct) });
export const explFastestLosesOnHeat = (heatMin: number) =>
  d("route.explain.fastestLosesOnHeat", { heatMin: Math.round(heatMin) });
export const explA0ChangedRanking = () => d("route.explain.a0ChangedRanking");
export const explViaStopOffered = (name: string) => d("route.explain.viaStopOffered", { name });
export const explSafetyBlock = () => d("route.explain.safetyBlock");
export const explCoolestWithinCap = (capPct: number) =>
  d("route.explain.coolestWithinCap", { capPct: Math.round(capPct) });

// --- plan-level ------------------------------------------------------------
export const noPath = () => d("route.noPath");
export const warnSafetyMaskDropped = () => d("route.warning.safetyMaskDropped");

// --- oases -----------------------------------------------------------------
export const oasisCooling = (name: string) => d("oasis.cooling", { name });
export const oasisWater = (name: string) => d("oasis.water", { name });
export const oasisPark = (name: string) => d("oasis.park", { name });
