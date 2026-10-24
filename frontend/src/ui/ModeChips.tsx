/**
 * ui/ModeChips.tsx — Google-Maps-style quick chips under the search pill.
 *
 * A horizontally scrollable radiogroup of the three route preferences (each
 * with its own colour + icon, and always its text label, so colour is never
 * the sole signal). It drives the same store value as the sheet's segmented
 * control and re-plans when both endpoints are set.
 */
import { useRef } from "react";
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { usePlan } from "@/api/usePlan";
import { Icon, type IconName } from "./Icon";
import type { ModeT } from "@/api/types";

const MODES: { value: ModeT; icon: IconName }[] = [
  { value: "fastest", icon: "bolt" },
  { value: "balanced", icon: "balance" },
  { value: "coolest", icon: "leaf" },
];

export function ModeChips() {
  const t = useT();
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);
  const plan = usePlan();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(m: ModeT) {
    if (m === mode) return;
    setMode(m);
    if (start && goal) void plan();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % MODES.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + MODES.length) % MODES.length;
    if (next < 0) return;
    e.preventDefault();
    choose(MODES[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className="mode-chips" role="radiogroup" aria-label={t("mode.label")}>
      {MODES.map((m, i) => {
        const on = m.value === mode;
        return (
          <button
            key={m.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={`mode-chip mode-chip--${m.value}${on ? " mode-chip--on" : ""}`}
            onClick={() => choose(m.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <Icon name={m.icon} size={16} filled={m.icon === "bolt"} />
            <span>{t(`mode.${m.value}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
