/**
 * ui/SegmentedControl.tsx — keyboard-operable segmented control (R5.5, R13.3).
 *
 * Rendered as a radiogroup: arrow keys move selection, Home/End jump to ends.
 * Option labels are provided already-translated by the caller.
 */
import { useRef } from "react";
import "./ui.css";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(index: number) {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    refs.current[index]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move((index + 1) % options.length);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move((index - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(options.length - 1);
        break;
    }
  }

  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className="segmented__option"
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
