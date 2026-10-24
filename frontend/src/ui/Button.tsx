/**
 * ui/Button.tsx — the primitive button (R3.3, R3.6).
 *
 * Variants: primary (ink) and secondary (paper). Flat offset shadow; pressed
 * state removes the shadow and shifts 2px. 48px minimum tap target. The label
 * is passed in by the caller (already translated) — this primitive has no copy.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({ variant = "primary", children, className, ...rest }: ButtonProps) {
  const cls = ["btn", variant === "primary" ? "btn--primary" : "btn--secondary", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
