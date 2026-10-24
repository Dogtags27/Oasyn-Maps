/**
 * ui/SearchBar.tsx — the Google-Maps-style trip search (R5.2, R5.5, R13.3).
 *
 * Collapsed by default: a single pill floating over the map, reading "Where
 * to?" or a start → destination summary once both are set. Tapping/Enter
 * expands it into the start + destination fields (R13.3's no-map-needed
 * search); finishing the second field, pressing Escape, or the close button
 * collapses it back. Every control is a real button, so the gesture has a
 * keyboard equivalent (R13.7); expand/collapse is announced for screen
 * readers (R13.4).
 */
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { announce } from "@/a11y/liveRegions";
import { PlaceSearch } from "./PlaceSearch";
import type { LatLngT } from "@/api/types";

export function SearchBar() {
  const t = useT();
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);
  const startLabel = useStore((s) => s.startLabel);
  const goalLabel = useStore((s) => s.goalLabel);
  const setStart = useStore((s) => s.setStart);
  const setGoal = useStore((s) => s.setGoal);
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function collapse() {
    setExpanded(false);
    announce(t("trip.searchCollapsed"));
    // Return focus to the pill so keyboard users land somewhere sensible.
    triggerRef.current?.focus();
  }

  function expand() {
    setExpanded(true);
    announce(t("trip.searchExpanded"));
  }

  function pickStart(at: LatLngT, name: string) {
    setStart(at, name);
    if (goal) collapse();
  }

  function pickGoal(at: LatLngT, name: string) {
    setGoal(at, name);
    if (start) collapse();
  }

  function swap() {
    setStart(goal, goalLabel);
    setGoal(start, startLabel);
  }

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") collapse();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  if (!expanded) {
    const summary =
      start && goal
        ? `${startLabel ?? t("trip.pinDropped")} → ${goalLabel ?? t("trip.pinDropped")}`
        : t("trip.whereTo");
    return (
      <button
        type="button"
        ref={triggerRef}
        className="search-bar search-bar--collapsed"
        aria-expanded={false}
        aria-label={t("trip.planTrip")}
        onClick={expand}
      >
        <span className="search-bar__icon" aria-hidden="true" />
        <span className="search-bar__summary">{summary}</span>
      </button>
    );
  }

  return (
    <div className="search-bar search-bar--expanded" role="group" aria-label={t("trip.planTrip")}>
      <div className="search-bar__fields">
        <div className="search-bar__field">
          <span className="search-bar__dot search-bar__dot--start" aria-hidden="true" />
          <PlaceSearch label={t("trip.start")} onPick={pickStart} />
        </div>
        <div className="search-bar__field">
          <span className="search-bar__dot search-bar__dot--goal" aria-hidden="true" />
          <PlaceSearch label={t("trip.destination")} onPick={pickGoal} />
        </div>
      </div>
      <div className="search-bar__actions">
        <button
          type="button"
          className="search-bar__swap"
          aria-label={t("trip.swap")}
          onClick={swap}
          disabled={!start && !goal}
        >
          ⇅
        </button>
        <button
          type="button"
          className="search-bar__close"
          aria-label={t("action.close")}
          onClick={collapse}
        >
          ×
        </button>
      </div>
    </div>
  );
}
