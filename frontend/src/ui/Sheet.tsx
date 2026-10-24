/**
 * ui/Sheet.tsx — a bottom sheet with three snap points (R5.2).
 *
 * Snap points: peek, half, and full (full stops below the floating search bar
 * so it stays reachable). The handle is a real button so the sheet is operable
 * by keyboard (Enter/Space and arrows cycle the snap points) — every gesture
 * has a button equivalent (R13.7). On touch/pointer devices the handle can also
 * be dragged; releasing snaps to the nearest point with an eased animation.
 * The caller supplies the handle's accessible label (already translated).
 */
import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import "./ui.css";

export type Snap = "peek" | "half" | "full";

const ORDER: Snap[] = ["peek", "half", "full"];
const PEEK_PX = 156;
/** Space kept clear above a full sheet for the floating search bar. */
const FULL_GAP_PX = 136;
const HEIGHTS: Record<Snap, string> = {
  peek: `${PEEK_PX}px`,
  half: "52%",
  full: `calc(100% - ${FULL_GAP_PX}px)`,
};
const DRAG_SLOP_PX = 5;

export interface SheetProps {
  handleLabel: string;
  children: ReactNode;
  initial?: Snap;
}

interface DragState {
  startY: number;
  startH: number;
  containerH: number;
  moved: boolean;
}

export function Sheet({ handleLabel, children, initial = "peek" }: SheetProps) {
  const [snap, setSnap] = useState<Snap>(initial);
  const [dragH, setDragH] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  function cycle(dir: 1 | -1) {
    const idx = ORDER.indexOf(snap);
    const next = Math.min(ORDER.length - 1, Math.max(0, idx + dir));
    setSnap(ORDER[next]);
  }

  function snapPx(s: Snap, containerH: number): number {
    if (s === "peek") return PEEK_PX;
    if (s === "half") return containerH * 0.52;
    return containerH - FULL_GAP_PX;
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    const node = sectionRef.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;
    drag.current = {
      startY: e.clientY,
      startH: node.getBoundingClientRect().height,
      containerH: parent.getBoundingClientRect().height,
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (!d.moved && Math.abs(dy) < DRAG_SLOP_PX) return;
    d.moved = true;
    const max = d.containerH - FULL_GAP_PX;
    setDragH(Math.min(max, Math.max(PEEK_PX * 0.7, d.startH + dy)));
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const h = dragH ?? d.startH;
    // Snap to the nearest point, biased by the drag direction.
    const velocityBias = (d.startY - e.clientY) * 0.25;
    let best: Snap = snap;
    let bestDist = Infinity;
    for (const s of ORDER) {
      const dist = Math.abs(snapPx(s, d.containerH) - (h + velocityBias));
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    setSnap(best);
    setDragH(null);
  }

  const dragging = dragH !== null;

  return (
    <section
      ref={sectionRef}
      className={`sheet sheet--${snap}${dragging ? " sheet--dragging" : ""}`}
      style={{ height: dragging ? `${dragH}px` : HEIGHTS[snap] }}
      aria-label={handleLabel}
    >
      <button
        type="button"
        className="sheet__handle"
        aria-label={handleLabel}
        aria-expanded={snap !== "peek"}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          // Tapping the handle cycles up, and wraps from full back to peek.
          if (snap === "full") setSnap("peek");
          else cycle(1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            cycle(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            cycle(-1);
          }
        }}
      />
      <div className="sheet__body">{children}</div>
    </section>
  );
}
