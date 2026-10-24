/**
 * ui/Legend.tsx — the ramp legend labelled "modeled exposure" (R4.3).
 *
 * Reads the band boundaries from config and shows the necklace -> amber -> brick
 * ramp with text labels (low / elevated / high). Colour is paired with a text
 * label so it is never the sole signal; the high swatch carries the tick pattern
 * used on the route.
 */
import { useT } from "@/i18n/useLocale";
import type { RampBand } from "@/map/ramp";

const BANDS: RampBand[] = ["low", "elevated", "high"];

export function Legend() {
  const t = useT();
  return (
    <div className="legend" aria-label={t("legend.title")}>
      <span className="legend__title">{t("legend.title")}</span>
      <ul className="legend__items">
        {BANDS.map((band) => (
          <li key={band} className="legend__item">
            <span
              className={`legend__swatch legend__swatch--${band}`}
              aria-hidden="true"
            />
            <span>{t(`legend.${band}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
