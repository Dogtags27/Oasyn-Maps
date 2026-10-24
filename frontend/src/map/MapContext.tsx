/**
 * map/MapContext.tsx — exposes the Leaflet map instance to layer components.
 *
 * Layers (route, oasis, trees, parks, safety, sun badge) are React components
 * that read this context and imperatively attach Leaflet layers to the map,
 * cleaning up on unmount. This keeps rendering declarative while using Leaflet's
 * imperative API underneath.
 */
import { createContext, useContext } from "react";
import type { Map as LeafletMap } from "leaflet";

export const MapContext = createContext<LeafletMap | null>(null);

export function useMap(): LeafletMap | null {
  return useContext(MapContext);
}
