/**
 * ui/RoutePeek.tsx — the sheet peek content (R5.2).
 *
 * Recommended time, heat-minutes, a one-line explanation descriptor, and a big
 * Start button in the thumb zone. Values are formatted via Intl; the sentence is
 * a backend descriptor rendered through t(). No-path keeps prior state and shows
 * an inline notice (R5.6).
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { formatDurationSec, formatMinutes } from "@/i18n/formatters";
import { Button } from "./Button";

export function RoutePeek() {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const route = useSelectedRoute();
  const noPath = useStore((s) => s.noPath);

  if (noPath) {
    return (
      <div className="route-peek" role="status">
        {t("route.noPath")}
      </div>
    );
  }

  if (!route) return null;

  return (
    <div className="route-peek">
      <div className="route-peek__stats">
        <span className="route-peek__time mono">
          {formatDurationSec(route.timeSec, locale)}
        </span>
        <span className="route-peek__heat mono">
          {formatMinutes(route.heatMinutes, locale)}
        </span>
      </div>
      {route.explanations[0] && (
        <p className="route-peek__why">{d(route.explanations[0])}</p>
      )}
      <Button variant="primary" className="route-peek__start">
        {t("trip.startWalk")}
      </Button>
    </div>
  );
}
