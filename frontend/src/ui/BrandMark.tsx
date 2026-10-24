/**
 * ui/BrandMark.tsx — the Oasyn logo mark: a gradient map pin cradling a leaf
 * (a cool oasis on the map). In-house SVG, brand-free, decorative only.
 * Gradient stops reference theme tokens so the mark follows Sun mode.
 */
import { useId } from "react";

export function BrandMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`bm-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--teal)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--violet)" }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="10" fill={`url(#bm-${id})`} />
      <path
        d="M16 26s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"
        fill="var(--on-color)"
        opacity="0.95"
      />
      <path
        d="M12.6 16.4c0-3.4 2.2-5.3 6-5.6c0 3.6-2 5.8-5.2 5.8M13.4 16.6c1-1.6 2.3-2.7 3.7-3.4"
        fill="none"
        stroke="var(--necklace)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
