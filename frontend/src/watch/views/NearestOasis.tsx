/**
 * watch/views/NearestOasis.tsx — bearing, distance, minutes to nearest oasis.
 *
 * Reads the nearest oasis from the selected route's oases list. Shows a bearing
 * arrow, the distance, and an estimate of walking minutes (distance / config
 * walk speed). "status unknown" is shown because sample oasis data is not
 * authoritative real-time status.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig } from "@/config";
import { formatDistance, formatMinutes, type FormatOptions } from "@/i18n/formatters";

export function NearestOasis() {
  const { t, d } = useLocale();
  const route = useSelectedRoute();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  const oasis = route?.oases?.[0] ?? null;
  if (!oasis) {
    return <div className="watch-view">{t("watch.nearestOasis")}</div>;
  }

  const minutes = oasis.distanceM / cfg.walkSpeedMps / 60;

  return (
    <div className="watch-view watch-oasis">
      <p className="watch-oasis__name">{d(oasis.name)}</p>
      <span className="watch-oasis__dist mono">{formatDistance(oasis.distanceM, fmt)}</span>
      <span className="watch-oasis__min mono">{formatMinutes(minutes, locale)}</span>
      <span className="watch-oasis__status">{t("watch.statusUnknown")}</span>
    </div>
  );
}
