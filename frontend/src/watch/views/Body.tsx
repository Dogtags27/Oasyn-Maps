/**
 * watch/views/Body.tsx — the watch Body view (R8.2).
 *
 * SIMULATED badge always visible. Shows HR vs baseline (from the scenario and
 * config). No diagnostic claims — this mirrors the phone WearablePanel on the
 * small canvas.
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
      <div className="watch-body__hr mono">
        {hr !== undefined ? formatNumber(hr, locale) : "\u2014"}
      </div>
      <div className="watch-body__base mono">
        {t("wearable.baseline")} {formatNumber(baseline, locale)}
      </div>
    </div>
  );
}
