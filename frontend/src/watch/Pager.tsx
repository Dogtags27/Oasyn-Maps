/**
 * watch/Pager.tsx — a horizontal pager navigable by Digital Crown (wheel),
 * arrow keys, swipe, and tap (R8.3).
 *
 * Renders the active view, a watchOS-style status bar (view title in its
 * accent colour, time on the right) for app views, and dot indicators. Keeps an internal index; the tap
 * target advances to the next view, wheel/arrows move either way, and touch
 * swipe moves by horizontal drag distance.
 */
import { useRef, useState, type ReactNode } from "react";

export interface PagerProps {
  /** `tone` colours the view title; `bare` views (the face) draw their own chrome. */
  views: { id: string; label: string; node: ReactNode; tone?: string; bare?: boolean }[];
  ariaLabel: string;
  /** Clock text for the watchOS-style status bar (title left, time right). */
  time?: string;
}

export function Pager({ views, ariaLabel, time }: PagerProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const go = (delta: number) =>
    setIndex((i) => (i + delta + views.length) % views.length);

  return (
    <div
      className="pager"
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      onWheel={(e) => go(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          go(-1);
        }
      }}
      onClick={() => go(1)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(dx) > 30) go(dx < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      {!views[index].bare && (
        <div className="pager__status" aria-hidden="true">
          <span className={`pager__title pager__title--${views[index].tone ?? "blue"}`}>
            {views[index].label}
          </span>
          {time && <span className="pager__time">{time}</span>}
        </div>
      )}
      <div className="pager__view" key={views[index].id}>
        {views[index].node}
      </div>
      <div className="pager__dots" aria-hidden="true">
        {views.map((v, i) => (
          <span key={v.id} className={`pager__dot${i === index ? " pager__dot--on" : ""}`} />
        ))}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {views[index].label}
      </span>
    </div>
  );
}
