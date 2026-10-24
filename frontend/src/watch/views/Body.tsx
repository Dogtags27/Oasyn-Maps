/**
 * watch/views/Body.tsx — the watch Body view (R8.2).
 *
 * SIMULATED badge always visible. Shows HR vs baseline (from the scenario and
 * config), with a decorative pulse-line glyph so the number reads as a heart
 * rate at a glance rather than a bare figure. No diagnostic claims — this
 * mirrors the phone WearablePanel on the small canvas.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { formatNumber } from "@/i18n/formatters";
import { Badge } from "@/ui/Badge";

export function Body() {
  const { t } = useLocale();
  const locale = useStore((s) => s.locale);
  const hr = useStore((s) => s.scenario.hr);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const baseline =
    typeof (cfg.raw as { body?: { HR_base?: number } }).body?.HR_base === "number"
      ? (cfg.raw as { body: { HR_base: number } }).body.HR_base
      : 70;

  return (
    <div className="watch-view watch-body">
      <Badge kind="simulated" label={t("badge.simulated")} />
      <svg width="104" height="32" viewBox="0 0 104 32" aria-hidden="true" className="watch-body__pulse">
        <path
          d="M0 17 H16 L22 5 L30 29 L38 17 H54 L60 9 L66 25 L72 17 H104"
          fill="none"
          stroke="var(--watch-brick)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="watch-body__hr mono">
        {formatNumber(hr ?? baseline, locale)}
      </div>
      <div className="watch-body__base mono">
        {t("wearable.baseline")} {formatNumber(baseline, locale)}
      </div>
    </div>
  );
}
