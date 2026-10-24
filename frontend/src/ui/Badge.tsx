/**
 * ui/Badge.tsx — mono uppercase pills (R3.5, R2.3).
 *
 * LIVE (necklace), SNAPSHOT (surface), ESTIMATED (amber), SIMULATED (plum, paper
 * text), SAMPLE DATA (dashed surface). The visible text comes from t() in the
 * caller via the `label` prop so it stays translatable; the `kind` only picks
 * the colour token.
 */
import "./ui.css";

export type BadgeKind = "live" | "snapshot" | "estimated" | "simulated" | "sample";

export interface BadgeProps {
  kind: BadgeKind;
  label: string;
  title?: string;
}

export function Badge({ kind, label, title }: BadgeProps) {
  return (
    <span className={`badge badge--${kind}`} title={title}>
      {label}
    </span>
  );
}
