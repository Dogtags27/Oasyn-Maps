/**
 * watch/views/NextMove.tsx — next turn glyph, distance, street, exposure strip.
 *
 * Reads the selected route's upcoming turn and the walker position from the
 * shared store, so it stays in sync with Lab playback (R8.4). The turn text is a
 * backend descriptor; the distance is mono. Street names are OSM-mapped. An
 * abstract directional arrow (ink-outlined, no icon pack, R16.3) gives the turn
 * a glanceable shape in addition to the sentence.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { formatDistance, type FormatOptions } from "@/i18n/formatters";

/** Rotation (degrees, 0 = up) for each turn descriptor key; "arrive" is special. */
const TURN_ROTATION: Record<string, number> = {
  "turn.left": -90,
  "turn.right": 90,
  "turn.slightLeft": -35,
  "turn.slightRight": 35,
  "turn.straight": 0,
  "turn.depart": 0,
};

function TurnGlyph({ turnKey }: { turnKey: string }) {
  if (turnKey === "turn.arrive") {
    return (
      <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true" className="watch-next__glyph">
        <line x1="8" y1="3" x2="8" y2="25" stroke="var(--watch-text)" strokeWidth="1.5" />
        <path d="M8 4 L22 8 L8 12 Z" stroke="var(--watch-text)" strokeWidth="1.5" fill="var(--watch-charles)" />
      </svg>
    );
  }
  const deg = TURN_ROTATION[turnKey] ?? 0;
  return (
    <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true" className="watch-next__glyph">
      <path d="M14 3 L22 17 L14 13 L6 17 Z" fill="var(--watch-text)" transform={`rotate(${deg} 14 14)`} />
    </svg>
  );
}

export function NextMove() {
  const { t, d } = useLocale();
  const route = useSelectedRoute();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const progress = useStore((s) => s.progress);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  if (!route || route.turns.length === 0) {
    return <div className="watch-view watch-empty">{t("trip.whereTo")}</div>;
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
      <TurnGlyph turnKey={turn.descriptor.key} />
      <span className="watch-next__dist mono">{formatDistance(remainingM, fmt)}</span>
      <p className="watch-next__turn">{d(turn.descriptor)}</p>
    </div>
  );
}
