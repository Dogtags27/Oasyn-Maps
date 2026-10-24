/**
 * ui/Sheet.tsx — a bottom sheet with three snap points (R5.2).
 *
 * Snap points: peek (120px), half (50vh), full (90vh). The handle is a real
 * button so the sheet is operable by keyboard (Enter/Space and arrows cycle the
 * snap points) — every gesture has a button equivalent (R13.7). The caller
 * supplies the handle's accessible label (already translated).
 */
import { useState, type ReactNode } from "react";
import "./ui.css";

export type Snap = "peek" | "half" | "full";

const ORDER: Snap[] = ["peek", "half", "full"];
const HEIGHTS: Record<Snap, string> = {
  peek: "120px",
  half: "50vh",
  full: "90vh",
};

export interface SheetProps {
  handleLabel: string;
  children: ReactNode;
  initial?: Snap;
}

export function Sheet({ handleLabel, children, initial = "peek" }: SheetProps) {
  const [snap, setSnap] = useState<Snap>(initial);

  function cycle(dir: 1 | -1) {
    const idx = ORDER.indexOf(snap);
    const next = Math.min(ORDER.length - 1, Math.max(0, idx + dir));
    setSnap(ORDER[next]);
  }

  return (
    <section className="sheet" style={{ height: HEIGHTS[snap] }} aria-label={handleLabel}>
      <button
        type="button"
        className="sheet__handle"
        aria-label={handleLabel}
        aria-expanded={snap !== "peek"}
        onClick={() => cycle(1 as const)}
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
