/**
 * safety/EstimateReadout.tsx — the modeled body estimate (R9.8).
 *
 * Renders "about X C (range ... to ...), illustrative model" with a gauge-arc
 * glyph. Never a bare number, never a diagnosis. The estimate, its range, and
 * the label all come from the backend /api/body response; temperatures are
 * formatted via Intl with the C/F pref.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { formatTemp, type FormatOptions } from "@/i18n/formatters";
import { gaugeGlyph } from "./glyphs";
import type { BodyResponseT } from "@/api/types";

export interface EstimateReadoutProps {
  body: BodyResponseT;
}

export function EstimateReadout({ body }: EstimateReadoutProps) {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  return (
    <div className="estimate-readout" role="status">
      <span
        className="estimate-readout__glyph"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: gaugeGlyph() }}
      />
      <span>
        {t("estimate.readout", {
          temp: formatTemp(body.tcUsed, fmt),
          low: formatTemp(body.rangeLow, fmt),
          high: formatTemp(body.rangeHigh, fmt),
        })}
      </span>
      <span className="estimate-readout__label">{d(body.label)}</span>
    </div>
  );
}
