/**
 * ui/RouteCard.tsx — a route summary card (R5.4, R5.5, R5.8).
 *
 * Shows time, distance, heat-minutes, shade %, arrival band, safety, and oasis
 * count, plus the explanation list rendered from backend descriptors via t().
 * Selecting the card makes it the active route. All numbers are formatted via
 * Intl (C/F, metric/imperial from prefs); no value is a literal.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import type { RouteResultT } from "@/api/types";
import {
  formatDurationSec,
  formatDistance,
  formatMinutes,
  formatPercent,
  type FormatOptions,
} from "@/i18n/formatters";
import { Badge } from "./Badge";

export interface RouteCardProps {
  route: RouteResultT;
  selected: boolean;
  recommended: boolean;
  onSelect: (id: string) => void;
}

export function RouteCard({ route, selected, recommended, onSelect }: RouteCardProps) {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  return (
    <article
      className={`route-card${selected ? " route-card--selected" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <button
        type="button"
        className="route-card__select"
        onClick={() => onSelect(route.id)}
        aria-pressed={selected}
      >
        <span className="route-card__mode">{t(`mode.${route.mode}`)}</span>
        {recommended && <Badge kind="snapshot" label={t("route.recommended")} />}
      </button>

      <dl className="route-card__metrics">
        <div>
          <dt>{t("route.metric.time")}</dt>
          <dd className="mono">{formatDurationSec(route.timeSec, locale)}</dd>
        </div>
        <div>
          <dt>{t("route.metric.distance")}</dt>
          <dd className="mono">{formatDistance(route.distanceM, fmt)}</dd>
        </div>
        <div>
          <dt>{t("route.metric.heatMin")}</dt>
          <dd className="mono">{formatMinutes(route.heatMinutes, locale)}</dd>
        </div>
        <div>
          <dt>{t("route.metric.shade")}</dt>
          <dd className="mono">{formatPercent(route.shadePct, locale)}</dd>
        </div>
        <div>
          <dt>{t("route.metric.arrival")}</dt>
          <dd>{t(`band.${route.arrivalBand}`)}</dd>
        </div>
        <div>
          <dt>{t("route.metric.oases")}</dt>
          <dd className="mono">{route.oases.length}</dd>
        </div>
      </dl>

      {route.explanations.length > 0 && (
        <div className="route-card__why">
          <h3>{t("route.explanationsTitle")}</h3>
          <ul>
            {route.explanations.map((e, i) => (
              <li key={i}>{d(e)}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
