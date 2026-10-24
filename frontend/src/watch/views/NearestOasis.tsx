/**
 * watch/views/NearestOasis.tsx — bearing, distance, minutes to nearest oasis.
 *
 * Reads the nearest oasis from the selected route's oases list. Shows a kind
 * glyph (cooling/water/park, reusing the map's own ink-outlined icons for visual
 * consistency, R16.1), a bearing arrow from the walker's current playback
 * position to the oasis, the distance, and an estimate of walking minutes
 * (distance / config walk speed). "status unknown" is shown because sample
 * oasis data is not authoritative real-time status.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig } from "@/config";
import { formatDistance, formatMinutes, type FormatOptions } from "@/i18n/formatters";
import { positionAt, bearingTo } from "@/lab/playback";
import { coolingGlyph, waterGlyph, treeGlyph } from "@/map/glyphs";

function kindGlyph(kind: string): string {
  if (kind === "water") return waterGlyph();
  if (kind === "park") return treeGlyph();
  return coolingGlyph();
}

export function NearestOasis() {
  const { t, d } = useLocale();
  const route = useSelectedRoute();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const config = useStore((s) => s.config);
  const progress = useStore((s) => s.progress);
  const cfg = viewConfig(config);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  const oasis = route?.oases?.[0] ?? null;
  if (!oasis) {
    return <div className="watch-view">{t("watch.nearestOasis")}</div>;
  }

  const minutes = oasis.distanceM / cfg.walkSpeedMps / 60;
  const walkerPos = route ? positionAt(route, progress) : null;
  const bearing = walkerPos ? bearingTo(walkerPos, oasis.at) : null;

  return (
    <div className="watch-view watch-oasis">
      <div className="watch-oasis__glyphs">
        <span
          className="watch-oasis__kind"
          aria-hidden="true"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: kindGlyph(oasis.kind) }}
        />
        {bearing !== null && (
          <svg
            width="24"
            height="24"
            viewBox="0 0 28 28"
            aria-hidden="true"
            className="watch-oasis__bearing"
            style={{ transform: `rotate(${bearing}deg)` }}
          >
            <path d="M14 3 L21 22 L14 17 L7 22 Z" fill="var(--watch-text)" />
          </svg>
        )}
      </div>
      <p className="watch-oasis__name">{d(oasis.name)}</p>
      <span className="watch-oasis__dist mono">{formatDistance(oasis.distanceM, fmt)}</span>
      <span className="watch-oasis__min mono">{formatMinutes(minutes, locale)}</span>
      <span className="watch-oasis__status">{t("watch.statusUnknown")}</span>
    </div>
  );
}
