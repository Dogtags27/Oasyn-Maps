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
  const pct = Math.round(frac * 100);
  const toneVar = band === "low" ? "necklace" : band === "elevated" ? "amber" : "brick";

  // ETA: scenario start time + route duration (display only).
  const eta = route
    ? formatTime(new Date(new Date(timeISO).getTime() + route.timeSec * 1000).toISOString(), locale)
    : "";

  return (
    <div className="watch-view watch-ring">
      <div className="watch-ring__dial">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--watch-ink)" strokeWidth="6" opacity="0.22" />
          {/* Band-boundary tick marks, so the dial reads like a gauge (R8.1). */}
          {[cfg.bands.b1, cfg.bands.b2].map((boundary, i) => (
            <line
              key={i}
              x1="70"
              y1="10"
              x2="70"
              y2="18"
              stroke="var(--watch-ink)"
              strokeWidth="2"
              opacity="0.7"
              transform={`rotate(${boundary * 360} 70 70)`}
            />
          ))}
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={`var(--watch-${toneVar})`}
            strokeWidth="6"
            strokeDasharray={`${C * frac} ${C}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        </svg>
        {/* Real DOM text (not inside the aria-hidden svg) so the reading stays
            available to screen readers, not just sighted users. */}
        <div className="watch-ring__center">
          <span className="watch-ring__pct mono">{pct}%</span>
          <span className="watch-ring__bandtext">{t(`band.${band}`)}</span>
        </div>
      </div>
      {eta && <span className="watch-ring__eta mono">{t("watch.eta", { time: eta })}</span>}
    </div>
  );
}
