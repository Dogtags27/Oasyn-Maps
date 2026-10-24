/**
 * ui/RoutePeek.tsx — the sheet peek content (R5.2).
 *
 * Recommended time, heat-minutes, a one-line explanation descriptor, a heat
 * strip (the route's modeled exposure along its length, coloured by band from
 * config), and a big Start button in the thumb zone. Values are formatted via
 * Intl; the sentence is a backend descriptor rendered through t(). No-path
 * keeps prior state and shows an inline notice (R5.6). With no trip yet, a
 * friendly prompt explains how to start.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig } from "@/config";
import { rampBand } from "@/map/ramp";
import { formatDurationSec, formatDistance, formatMinutes } from "@/i18n/formatters";
import type { RouteResultT } from "@/api/types";
import { Button } from "./Button";
import { Icon } from "./Icon";

const STRIP_STEPS = 24;

function HeatStrip({ route }: { route: RouteResultT }) {
  const config = useStore((s) => s.config);
  const { t } = useLocale();
  const cfg = viewConfig(config);
  const trace = route.aTrace;
  if (trace.length === 0) return null;
  const cells = Array.from({ length: STRIP_STEPS }, (_, i) => {
    const idx = Math.min(trace.length - 1, Math.round((i / (STRIP_STEPS - 1)) * (trace.length - 1)));
    return rampBand(trace[idx][2], cfg.bands);
  });
  return (
    <div className="heat-strip" role="img" aria-label={t("legend.title")}>
      {cells.map((band, i) => (
        <span
          key={i}
          className={`heat-strip__cell heat-strip__cell--${band}`}
          style={{ animationDelay: `${i * 18}ms` }}
        />
      ))}
    </div>
  );
}

export function RoutePeek() {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const route = useSelectedRoute();
  const noPath = useStore((s) => s.noPath);
  const loading = useStore((s) => s.planning);

  if (noPath) {
    return (
      <div className="route-peek route-peek--empty" role="status">
        <span className="route-peek__empty-icon route-peek__empty-icon--warn">
          <Icon name="info" size={22} />
        </span>
        <span>{t("route.noPath")}</span>
      </div>
    );
  }
  if (!route) {
    return (
      <div className={`route-peek route-peek--empty${loading ? " route-peek--loading" : ""}`}>
        <span className="route-peek__empty-icon">
          <Icon name="pin" size={22} />
        </span>
        <span className="route-peek__hint">{t("trip.tapMap")}</span>
      </div>
    );
  }
  return (
    <div className="route-peek" key={route.id}>
      <div className="route-peek__row">
        <div className="route-peek__stats">
          <span className="route-peek__time mono">{formatDurationSec(route.timeSec, locale)}</span>
          <span className="route-peek__sub">
            <span className="route-peek__dist mono">
              {formatDistance(route.distanceM, { locale, tempUnit, distanceUnit })}
            </span>
            <span className={`route-peek__heat route-peek__heat--${route.arrivalBand} mono`}>
              <Icon name="heat" size={14} />
              {formatMinutes(route.heatMinutes, locale)}
            </span>
          </span>
        </div>
        <Button variant="primary" className="route-peek__start">
          <Icon name="walk" size={20} />
          {t("trip.startWalk")}
        </Button>
      </div>
      <HeatStrip route={route} />
      {route.explanations[0] && <p className="route-peek__why">{d(route.explanations[0])}</p>}
    </div>
  );
}
