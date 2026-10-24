/**
 * map/tiles.ts — CARTO Voyager basemap config (R4.1).
 *
 * Voyager is a colourful, Google-Maps-like basemap (soft greens for parks, blue
 * water, warm roads) that still keeps labels light enough for the app's own
 * layers to read on top. Opacity is full normally and 50% in Sun mode; both
 * come from the --tile-opacity token so they follow the theme. If a tile fails to load the MapView falls back to
 * graph-derived art (R4.6).
 *
 * CARTO retired anonymous access to basemaps.cartocdn.com: requests without a
 * key now come back as a watermarked "API KEY REQUIRED" tile instead of an
 * HTTP error, so `tileerror` never fires and the map looks "broken" rather
 * than falling back. Get a free key at https://carto.com/basemaps/apikey and
 * set VITE_CARTO_API_KEY in frontend/.env.
 */
const CARTO_BASE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/** Tile URL template, with the CARTO API key appended when configured. */
export function cartoTileUrl(): string {
  const key = import.meta.env?.VITE_CARTO_API_KEY;
  return key ? `${CARTO_BASE_URL}?key=${key}` : CARTO_BASE_URL;
}

/** @deprecated use {@link cartoTileUrl} — kept for any external references. */
export const CARTO_POSITRON_URL = CARTO_BASE_URL;

export const CARTO_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO';

export const CARTO_SUBDOMAINS = "abcd";
export const MAX_ZOOM = 20;

/** Read the current tile opacity from the --tile-opacity token. */
export function tileOpacity(): number {
  if (typeof getComputedStyle === "undefined") return 1;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--tile-opacity")
    .trim();
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 1;
}
