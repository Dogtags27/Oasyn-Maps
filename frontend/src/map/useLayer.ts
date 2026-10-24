/**
 * map/useLayer.ts — load a named layer's GeoJSON-ish features via the client.
 *
 * Layers come from /api/layers/:name (mock resolves the sample seed). A failure
 * leaves features empty and sets nothing destructive — the map simply omits that
 * layer and the resilience notice elsewhere covers hard failures.
 */
import { useEffect, useState } from "react";
import { useClient } from "@/api/useClient";
import type { LayerNameT, LayerResponseT } from "@/api/types";

export function useLayer(name: LayerNameT): LayerResponseT | null {
  const client = useClient();
  const [data, setData] = useState<LayerResponseT | null>(null);

  useEffect(() => {
    let active = true;
    client
      .getLayer(name)
      .then((d) => active && setData(d))
      .catch(() => {
        /* omit the layer on failure */
      });
    return () => {
      active = false;
    };
  }, [client, name]);

  return data;
}

/** Extract [lat, lng] from a GeoJSON Point feature. */
export function pointLatLng(
  feature: Record<string, unknown>,
): [number, number] | null {
  const geom = feature.geometry as { type?: string; coordinates?: number[] } | undefined;
  if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates)) return null;
  const [lng, lat] = geom.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return [lat, lng];
}

/** Extract a polygon ring as [lat,lng][] from a GeoJSON Polygon feature. */
export function polygonLatLngs(
  feature: Record<string, unknown>,
): [number, number][] | null {
  const geom = feature.geometry as
    | { type?: string; coordinates?: number[][][] }
    | undefined;
  if (!geom || geom.type !== "Polygon" || !Array.isArray(geom.coordinates)) return null;
  const ring = geom.coordinates[0];
  if (!Array.isArray(ring)) return null;
  return ring.map(([lng, lat]) => [lat, lng] as [number, number]);
}
