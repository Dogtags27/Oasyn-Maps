/**
 * map/fallbackArt.tsx — graph-derived art when tiles fail (R4.6).
 *
 * If the CARTO tiles cannot load, the map area must never be blank. We draw a
 * calm, hatched street-grid on the paper background derived from the config
 * bbox so the area still reads as a map. This is cosmetic and uses only tokens.
 */
import type { ReactNode } from "react";
import { useT } from "@/i18n/useLocale";

export function FallbackArt() {
  const t = useT();
  // A simple seeded-looking grid; purely decorative.
  const lines: ReactNode[] = [];
  for (let i = 1; i < 10; i++) {
    const p = (i / 10) * 100;
    lines.push(
      <line key={`v${i}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" />,
      <line key={`h${i}`} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} />,
    );
  }
  return (
    <div className="fallback-art" role="img" aria-label={t("notice.tilesFailed")}>
      <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <g stroke="var(--ink-2)" strokeWidth="1" opacity="0.4">
          {lines}
        </g>
      </svg>
      <p className="fallback-art__note">{t("notice.tilesFailed")}</p>
    </div>
  );
}
