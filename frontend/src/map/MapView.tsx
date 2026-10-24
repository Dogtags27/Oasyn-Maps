/**
 * map/MapView.tsx — the Leaflet base map (R4.1, R4.6, R13.3).
 *
 * Centred on Northeastern (from config), CARTO Positron tiles at the
 * --tile-opacity token (70% / 50% in Sun mode), keyboard enabled. If tiles fail
 * to load we render the graph-derived fallback art so the area is never blank.
 * Child layer components receive the map through MapContext.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { viewConfig } from "@/config";
import { useStore } from "@/store";
import { useT } from "@/i18n/useLocale";
import {
  cartoTileUrl,
  CARTO_ATTRIBUTION,
  CARTO_SUBDOMAINS,
  MAX_ZOOM,
  tileOpacity,
} from "./tiles";
import { MapContext } from "./MapContext";
import { FallbackArt } from "./fallbackArt";

export interface MapViewProps {
  children?: ReactNode;
  /** Called when the user clicks the map (for setting start/destination/zones). */
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
}

export function MapView({ children, onMapClick }: MapViewProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const config = useStore((s) => s.config);
  const sunMode = useStore((s) => s.sunMode);
  const tilesFailed = useStore((s) => s.tilesFailed);
  const setTilesFailed = useStore((s) => s.setTilesFailed);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const cfg = viewConfig(config);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || map) return;
    const m = L.map(containerRef.current, {
      center: [cfg.center.lat, cfg.center.lon],
      zoom: 15,
      keyboard: true,
      zoomControl: true,
      attributionControl: true,
    });

    const tiles = L.tileLayer(cartoTileUrl(), {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_SUBDOMAINS,
      maxZoom: MAX_ZOOM,
      opacity: tileOpacity(),
    });
    tiles.on("tileerror", () => setTilesFailed(true));
    tiles.addTo(m);
    tileLayerRef.current = tiles;

    if (onMapClick) {
      m.on("click", (e: L.LeafletMouseEvent) =>
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
      );
    }

    setMap(m);
    return () => {
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep tile opacity in sync with Sun mode.
  useEffect(() => {
    tileLayerRef.current?.setOpacity(tileOpacity());
  }, [sunMode]);

  return (
    <div className="mapview">
      <div
        ref={containerRef}
        className="mapview__canvas"
        role="application"
        aria-label={t("a11y.map")}
      />
      {tilesFailed && <FallbackArt />}
      <MapContext.Provider value={map}>{map ? children : null}</MapContext.Provider>
    </div>
  );
}
