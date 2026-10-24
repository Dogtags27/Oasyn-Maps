/**
 * safety/WearablePanel.tsx — the simulated wearable (R10.1, R10.2).
 *
 * Always labelled SIMULATED. Shows the simulated HR against a baseline (baseline
 * from config.body.HR_base), with no diagnostic claims. When HR or body-temp
 * margins are exceeded the backend returns a reroute/break offer, which the Lab
 * surfaces via the offer channel — this panel only displays the reading.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { formatNumber } from "@/i18n/formatters";
import { Badge } from "@/ui/Badge";

export function WearablePanel() {
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
    <section className="wearable" aria-label={t("wearable.title")}>
      <div className="wearable__head">
        <h3>{t("wearable.title")}</h3>
        <Badge kind="simulated" label={t("badge.simulated")} />
      </div>
      <dl className="wearable__readings">
        <div>
          <dt>{t("wearable.hr")}</dt>
          <dd className="mono">
            {hr !== undefined ? formatNumber(hr, locale) : "\u2014"}
          </dd>
        </div>
        <div>
          <dt>{t("wearable.baseline")}</dt>
          <dd className="mono">{formatNumber(baseline, locale)}</dd>
        </div>
      </dl>
      <p className="wearable__note">{t("wearable.noDiagnosis")}</p>
    </section>
  );
}
