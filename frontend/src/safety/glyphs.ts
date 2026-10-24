/**
 * safety/glyphs.ts — in-house SVG glyphs for the safety UI (R9.3, R9.8).
 *
 * A leaf-in-triangle caution glyph and a gauge-arc estimate glyph, ink-outlined
 * and abstract, matching the field-guide character. Colours reference tokens.
 */

function wrap(inner: string, size = 24): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** Leaf inside a warning triangle (caution). */
export function cautionGlyph(): string {
  return wrap(
    `<path d="M12 3 L22 21 L2 21 Z" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round" />
     <path d="M12 9 C 9 12, 9 16, 12 18 C 15 16, 15 12, 12 9 Z" fill="var(--amber)" stroke="var(--ink)" stroke-width="1.2" />
     <line x1="12" y1="12" x2="12" y2="18" stroke="var(--ink)" stroke-width="1" />`,
  );
}

/** A gauge arc with a needle (estimate readout). */
export function gaugeGlyph(): string {
  return wrap(
    `<path d="M4 18 A 8 8 0 0 1 20 18" fill="none" stroke="var(--ink)" stroke-width="1.5" />
     <line x1="12" y1="18" x2="16" y2="12" stroke="var(--brick)" stroke-width="2" stroke-linecap="round" />
     <circle cx="12" cy="18" r="1.5" fill="var(--ink)" />`,
  );
}
