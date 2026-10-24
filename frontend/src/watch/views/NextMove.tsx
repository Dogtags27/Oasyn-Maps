/**
 * watch/views/NextMove.tsx — next turn glyph, distance, street, exposure strip.
 *
 * Reads the selected route's upcoming turn and the walker position from the
 * shared store, so it stays in sync with Lab playback (R8.4). The turn text is a
 * backend descriptor; the distance is mono. Street names are OSM-mapped.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { formatDistance, type FormatOptions } from "@/i18n/formatters";

export function NextMove() {
  const { t, d } = useLocale();
  const route = useSelectedRoute();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const progress = useStore((s) => s.progress);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  if (!route || route.turns.length === 0) {
    return <div className="watch-view">{t("watch.nextMove")}</div>;
  }

  // The next turn is the first turn past the current progress.
  const turnIndex = Math.min(
    route.turns.length - 1,
    Math.floor(progress * route.turns.length) + (progress > 0 ? 1 : 0),
  );
  const turn = route.turns[turnIndex];
  const remainingM = route.distanceM * (1 - progress);

  return (
    <div className="watch-view watch-next">
      <span className="watch-next__dist mono">{formatDistance(remainingM, fmt)}</span>
      <p className="watch-next__turn">{d(turn.descriptor)}</p>
    </div>
  );
}
