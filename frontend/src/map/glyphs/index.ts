/**
 * map/glyphs/ — in-house SVG divIcon builders (R4.4, R16.1, R16.3).
 *
 * All glyphs are ink-outlined, abstract, and brand-free: a cooling hexagon, a
 * water droplet, a start ring, a destination pennant, a walker, a tree, and a
 * sun badge rotated to the azimuth. No icon pack. Colours reference CSS token
 * variables so they follow the theme / Sun mode. Returns the raw SVG markup
 * string; the map wraps it in a Leaflet divIcon.
 */

function svg(inner: string, size = 28): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true" focusable="false">${inner}</svg>`;
}

const STROKE = 'stroke="var(--ink)" stroke-width="1.5" fill="var(--paper)"';

export function coolingGlyph(): string {
  return svg(
    `<polygon points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5" ${STROKE} />
     <path d="M14 9 v10 M9 14 h10" stroke="var(--necklace)" stroke-width="2" fill="none" />`,
  );
}

export function waterGlyph(): string {
  return svg(
    `<path d="M14 3 C 20 11, 22 15, 22 18 a8 8 0 0 1 -16 0 c0 -3, 2 -7, 8 -15 Z" ${STROKE} />
     <circle cx="14" cy="18" r="3" fill="var(--charles)" />`,
  );
}

export function startGlyph(): string {
  return svg(
    `<circle cx="14" cy="14" r="9" ${STROKE} />
     <circle cx="14" cy="14" r="4" fill="var(--ink)" />`,
  );
}

export function destinationGlyph(): string {
  return svg(
    `<line x1="8" y1="3" x2="8" y2="25" stroke="var(--ink)" stroke-width="1.5" />
     <path d="M8 4 L22 8 L8 12 Z" ${STROKE} />`,
  );
}

export function walkerGlyph(): string {
  // Abstract walker: head and two strides, no hand gestures (R16.3).
  return svg(
    `<circle cx="14" cy="6" r="3" ${STROKE} />
     <path d="M14 9 v7 M14 16 l-4 7 M14 16 l4 7 M10 12 h8" stroke="var(--ink)" stroke-width="1.5" fill="none" stroke-linecap="round" />`,
  );
}

export function treeGlyph(rotationDeg = 0): string {
  return svg(
    `<g transform="rotate(${rotationDeg} 14 14)">
       <path d="M14 4 C 9 8, 9 14, 14 14 C 19 14, 19 8, 14 4 Z" stroke="var(--necklace)" stroke-width="1.5" fill="var(--paper)" />
       <line x1="14" y1="14" x2="14" y2="22" stroke="var(--ink)" stroke-width="1.5" />
     </g>`,
    22,
  );
}

/** Sun badge: an octagon rotated to the azimuth; elevation drawn by the caller. */
export function sunBadgeGlyph(azimuthDeg: number): string {
  return svg(
    `<g transform="rotate(${azimuthDeg} 14 14)">
       <polygon points="14,3 19,5 24,10 24,18 19,23 9,23 4,18 4,10 9,5"
         stroke="var(--ink)" stroke-width="1.5" fill="var(--sun)" />
       <line x1="14" y1="3" x2="14" y2="0" stroke="var(--ink)" stroke-width="2" />
     </g>`,
    30,
  );
}
