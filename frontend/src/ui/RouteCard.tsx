/**
 * ui/RouteCard.tsx — a route summary card (R5.4, R5.5, R5.8).
 *
 * Shows time, distance, heat-minutes, shade %, arrival band, safety, and oasis
 * count, plus the explanation list rendered from backend descriptors via t().
 * Selecting the card makes it the active route. All numbers are formatted via
 * Intl (C/F, metric/imperial from prefs); no value is a literal. Each mode has
 * its own accent colour and icon; the text label always accompanies them.
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
import { Icon, type IconName } from "./Icon";

const MODE_ICON: Record<string, IconName> = {
  fastest: "bolt",
  balanced: "balance",
  coolest: "leaf",
};

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
      className={`route-card route-card--${route.mode}${selected ? " route-card--selected" : ""}`}
      aria-current={selected ? "true" : undefined}
    >
      <button
        type="button"
        className="route-card__select"
        onClick={() => onSelect(route.id)}
        aria-pressed={selected}
      >
        <span className="route-card__mode-icon">
          <Icon name={MODE_ICON[route.mode] ?? "route"} size={20} filled={route.mode === "fastest"} />
        </span>
        <span className="route-card__title">
          <span className="route-card__mode">{t(`mode.${route.mode}`)}</span>
          {recommended && <Badge kind="snapshot" label={t("route.recommended")} />}
        </span>
        <span className="route-card__check" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
      </button>
      <dl className="route-card__metrics">
        <div className="metric metric--time">
          <dt>
            <Icon name="clock" size={14} />
            {t("route.metric.time")}
          </dt>
          <dd className="mono">{formatDurationSec(route.timeSec, locale)}</dd>
        </div>
        <div className="metric metric--distance">
          <dt>
            <Icon name="ruler" size={14} />
            {t("route.metric.distance")}
          </dt>
          <dd className="mono">{formatDistance(route.distanceM, fmt)}</dd>
        </div>
        <div className="metric metric--heat">
          <dt>
            <Icon name="heat" size={14} />
            {t("route.metric.heatMin")}
          </dt>
          <dd className="mono">{formatMinutes(route.heatMinutes, locale)}</dd>
        </div>
        <div className="metric metric--shade">
          <dt>
            <Icon name="shade" size={14} />
            {t("route.metric.shade")}
          </dt>
          <dd className="mono">{formatPercent(route.shadePct, locale)}</dd>
        </div>
        <div className={`metric metric--band metric--band-${route.arrivalBand}`}>
          <dt>
            <Icon name="sun" size={14} />
            {t("route.metric.arrival")}
          </dt>
          <dd>{t(`band.${route.arrivalBand}`)}</dd>
        </div>
        <div className="metric metric--oases">
          <dt>
            <Icon name="drop" size={14} />
            {t("route.metric.oases")}
          </dt>
          <dd className="mono">{route.oases.length}</dd>
        </div>
      </dl>
      {route.explanations.length > 0 && (
        <div className="route-card__why">
          <h3>
            <Icon name="spark" size={16} />
            {t("route.explanationsTitle")}
          </h3>
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
