/**
 * map/glyphs/ — in-house SVG divIcon builders (R4.4, R16.1, R16.3).
 *
 * Bright, map-app style markers: a pulsing blue start dot, a red destination
 * pin, a teal cooling badge, a blue water droplet, a walker puck, a tree, and
 * a sun badge rotated to the azimuth. All glyphs are abstract and brand-free;
 * no icon pack. Colours reference CSS token variables so they follow the theme
 * / Sun mode. Each marker keeps a white ring so it reads on any tile colour.
 * Returns the raw SVG markup string; the map wraps it in a Leaflet divIcon.
 */

function svg(inner: string, size = 28, viewBox = "0 0 28 28"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** A soft drop shadow ellipse under round markers. */
const SHADOW = `<ellipse cx="14" cy="25.5" rx="6" ry="1.6" fill="var(--route-shadow)" />`;

export function coolingGlyph(): string {
  return svg(
    `${SHADOW}
     <circle cx="14" cy="13" r="11" fill="var(--paper)" />
     <circle cx="14" cy="13" r="9" fill="var(--teal)" />
     <path d="M14 7.5v11M9.2 10.2l9.6 5.6M18.8 10.2l-9.6 5.6" stroke="var(--on-color)" stroke-width="1.8" stroke-linecap="round" fill="none" />`,
  );
}

export function waterGlyph(): string {
  return svg(
    `${SHADOW}
     <circle cx="14" cy="13" r="11" fill="var(--paper)" />
     <circle cx="14" cy="13" r="9" fill="var(--charles)" />
     <path d="M14 7.5c2.6 3.2 4 5.4 4 7.2a4 4 0 0 1-8 0c0-1.8 1.4-4 4-7.2z" fill="var(--on-color)" />`,
  );
}

export function startGlyph(): string {
  return svg(
    `<circle class="glyph-pulse" cx="14" cy="14" r="13" fill="var(--halo-primary)" />
     <circle cx="14" cy="14" r="8.5" fill="var(--paper)" />
     <circle cx="14" cy="14" r="6" fill="var(--primary)" />`,
  );
}

export function destinationGlyph(): string {
  return svg(
    `<ellipse cx="16" cy="38" rx="5" ry="1.6" fill="var(--route-shadow)" />
     <path d="M16 37s-11-10-11-19a11 11 0 0 1 22 0c0 9-11 19-11 19z" fill="var(--brick)" stroke="var(--paper)" stroke-width="2" />
     <circle cx="16" cy="18" r="4.2" fill="var(--paper)" />`,
    32,
    "0 0 32 40",
  );
}

export function walkerGlyph(): string {
  // Abstract walker inside a puck: head and two strides, no hand gestures (R16.3).
  return svg(
    `<circle class="glyph-pulse" cx="14" cy="14" r="13" fill="var(--halo-primary)" />
     <circle cx="14" cy="14" r="10" fill="var(--paper)" />
     <circle cx="14" cy="14" r="8.5" fill="var(--primary)" />
     <circle cx="14.6" cy="8.6" r="1.6" fill="var(--on-color)" />
     <path d="M14.4 11v4.4M14.4 15.4l-2.6 3.8M14.4 15.4l2.6 3.8M11.4 13h6" stroke="var(--on-color)" stroke-width="1.6" fill="none" stroke-linecap="round" />`,
  );
}

export function treeGlyph(rotationDeg = 0): string {
  return svg(
    `<g transform="rotate(${rotationDeg} 14 14)">
       <circle cx="14" cy="11" r="7" fill="var(--necklace)" opacity="0.85" />
       <path d="M10.5 11.5c1.5-2.8 4-4 7-3.8" stroke="var(--on-color)" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7" />
       <line x1="14" y1="17" x2="14" y2="22" stroke="var(--ink-2)" stroke-width="1.6" stroke-linecap="round" />
     </g>`,
    20,
  );
}

/** Sun badge: a sun with a pointer rotated to the azimuth; elevation drawn by the caller. */
export function sunBadgeGlyph(azimuthDeg: number): string {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = 14 + Math.cos(a) * 8.5;
    const y1 = 14 + Math.sin(a) * 8.5;
    const x2 = 14 + Math.cos(a) * 11;
    const y2 = 14 + Math.sin(a) * 11;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`;
  }).join("");
  return svg(
    `<g transform="rotate(${azimuthDeg} 14 14)">
       <g stroke="var(--sun)" stroke-width="2" stroke-linecap="round">${rays}</g>
       <circle cx="14" cy="14" r="6.5" fill="var(--sun)" />
       <path d="M14 0.5l2.2 3.6h-4.4z" fill="var(--amber)" />
     </g>`,
    30,
  );
}
