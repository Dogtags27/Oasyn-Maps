/**
 * watch/Complications.tsx — mock watch-face complications (R8.7).
 *
 * Circular complication = the exposure ring; rectangular = next turn + band.
 * Rendered on a mock face so the watch reads as a glanceable device. Values come
 * from the shared store.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig, bandForExposure } from "@/config";

export function Complications() {
  const { t, d } = useLocale();
  const a = useStore((s) => s.a);
  const config = useStore((s) => s.config);
  const route = useSelectedRoute();
  const cfg = viewConfig(config);
  const band = bandForExposure(a, cfg.bands);
  const frac = Math.max(0, Math.min(1, a));
  const C = 2 * Math.PI * 18;
  const nextTurn = route?.turns?.[0];

  return (
    <div className="complications" aria-label={t("watch.exposureRing")}>
      <div className="complication complication--circular">
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="18" fill="none" stroke="var(--watch-ink)" strokeWidth="4" opacity="0.3" />
          <circle
            cx="24"
            cy="24"
            r="18"
            fill="none"
            stroke={`var(--watch-${band === "low" ? "necklace" : band === "elevated" ? "amber" : "brick"})`}
            strokeWidth="4"
            strokeDasharray={`${C * frac} ${C}`}
            transform="rotate(-90 24 24)"
          />
        </svg>
      </div>
      <div className="complication complication--rect">
        <span className="complication__turn">{nextTurn ? d(nextTurn.descriptor) : t("watch.nextMove")}</span>
        <span className="complication__band">{t(`band.${band}`)}</span>
      </div>
    </div>
  );
}
