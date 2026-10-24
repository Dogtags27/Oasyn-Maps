/**
 * ui/Button.tsx — the primitive button (R3.3, R3.6).
 *
 * Variants: primary (gradient pill with glow), secondary (white outlined pill),
 * and tonal (soft primary tint). Hover lifts, press scales down with a ripple
 * flash (motion is disabled under reduced motion). 48px minimum tap target. The label
 * is passed in by the caller (already translated) — this primitive has no copy.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tonal";
  children: ReactNode;
}

export function Button({ variant = "primary", children, className, ...rest }: ButtonProps) {
  const cls = ["btn", `btn--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
