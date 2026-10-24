/**
 * ui/Slider.tsx — a labelled range input (R7.1).
 *
 * A native range for full keyboard support, with a mono value readout. The
 * label and formatted value are supplied by the caller (already translated /
 * formatted). The min/max/step come from config-derived ranges, never literals
 * in a component.
 */
import "./ui.css";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step, valueText, onChange }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider__label">
        {label}
        <span className="slider__value mono">{valueText}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
