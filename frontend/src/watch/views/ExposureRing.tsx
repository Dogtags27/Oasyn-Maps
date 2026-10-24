/**
 * watch/views/ExposureRing.tsx — accumulated exposure vs scale, band, ETA.
 *
 * The ring shows the walker's current accumulated exposure A against the scale,
 * with the band label "modeled" and an ETA. A comes from the shared walker state
 * (sampled from aTrace in the Lab), never recomputed here. The band boundaries
 * come from config.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig, bandForExposure } from "@/config";
import { formatTime } from "@/i18n/formatters";

export function ExposureRing() {
  const { t } = useLocale();
  const a = useStore((s) => s.a);
  const locale = useStore((s) => s.locale);
  const config = useStore((s) => s.config);
  const route = useSelectedRoute();
  const timeISO = useStore((s) => s.scenario.timeISO);
  const cfg = viewConfig(config);

  const band = bandForExposure(a, cfg.bands);
  const frac = Math.max(0, Math.min(1, a));
  const R = 56;
  const C = 2 * Math.PI * R;

  // ETA: scenario start time + route duration (display only).
  const eta = route
    ? formatTime(new Date(new Date(timeISO).getTime() + route.timeSec * 1000).toISOString(), locale)
    : "";

  return (
    <div className="watch-view watch-ring">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--watch-ink)" strokeWidth="6" opacity="0.3" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={`var(--watch-${band === "low" ? "necklace" : band === "elevated" ? "amber" : "brick"})`}
          strokeWidth="6"
          strokeDasharray={`${C * frac} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
      </svg>
      <span className="watch-ring__band">{t("legend.title")}</span>
      <span className="watch-ring__band-label">{t(`band.${band}`)}</span>
      {eta && <span className="watch-ring__eta mono">{t("watch.eta", { time: eta })}</span>}
    </div>
  );
}
