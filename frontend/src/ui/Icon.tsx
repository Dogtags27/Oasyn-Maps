/**
 * ui/Icon.tsx — a tiny in-house line-icon set (R16.1).
 *
 * Brand-free, 24px grid, drawn with currentColor so icons follow the text
 * colour of whatever they sit in. Always decorative (aria-hidden): the
 * accessible name comes from the surrounding control's translated label.
 */
import type { CSSProperties } from "react";

export type IconName =
  | "search"
  | "swap"
  | "close"
  | "map"
  | "lab"
  | "watch"
  | "sun"
  | "globe"
  | "walk"
  | "bolt"
  | "balance"
  | "leaf"
  | "heat"
  | "clock"
  | "ruler"
  | "shade"
  | "drop"
  | "pin"
  | "play"
  | "pause"
  | "heart"
  | "shield"
  | "spark"
  | "route"
  | "info"
  | "check"
  | "arrow";

const PATHS: Record<IconName, string> = {
  search: "M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM15.5 15.5L20 20",
  swap: "M7 4v14M7 4L4 7M7 4l3 3M17 20V6M17 20l-3-3M17 20l3-3",
  close: "M6 6l12 12M18 6L6 18",
  map: "M9 4L3 6.5v13.5L9 17.5l6 2.5l6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20",
  lab: "M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9",
  watch: "M8 6.5V3h8v3.5M8 17.5V21h8v-3.5M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM12 9.5V12l1.5 1.5",
  sun: "M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
  globe: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9",
  walk: "M13 4.5a1.5 1.5 0 1 1 0 .01M10 21l2.5-6.5L15 17v4M9 11.5l1.5-3.5l3 1l2 3.5l2.5 1M10.5 8l-3 2v3.5",
  bolt: "M13 2L5 13.5h6L10 22l8-11.5h-6L13 2z",
  balance: "M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a2.5 2.5 0 0 0 5 0L5 8zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0L19 8z",
  leaf: "M5 19C5 10 10 5 20 4c0 10-5 15-13 15M5 19c3-4 6-7 10-9",
  heat: "M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4.5-10.5c-1 3-2.5 4-4 4.5C10 7 9.5 5.5 9.5 4C7 6.5 5 10 5 15a7 7 0 0 0 7 7zM12 22a3 3 0 0 1-3-3c0-2 1.5-3 3-5c1.5 2 3 3 3 5a3 3 0 0 1-3 3z",
  clock: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7.5V12l3 2",
  ruler: "M3 16.5L16.5 3L21 7.5L7.5 21L3 16.5zM7 12.5l2 2M10 9.5l2 2M13 6.5l2 2",
  shade: "M3 12a9 9 0 0 1 18 0H3zM12 12v7a2 2 0 0 1-4 0",
  drop: "M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11z",
  pin: "M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5z",
  play: "M8 5.5v13l10.5-6.5L8 5.5z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  heart: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z",
  shield: "M12 3l7.5 3v5.5c0 4.7-3.2 8.3-7.5 9.5c-4.3-1.2-7.5-4.8-7.5-9.5V6L12 3zM9 12l2 2l4-4",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z",
  route: "M6 19a2 2 0 1 1 0-.01M18 7a2 2 0 1 1 0-.01M6 17V9.5A3.5 3.5 0 0 1 9.5 6h0A3.5 3.5 0 0 1 13 9.5v5a3.5 3.5 0 0 0 3.5 3.5h0A3.5 3.5 0 0 0 20 14.5V9",
  info: "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 11v5.5M12 7.5v.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6l-6 6",
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Filled glyphs (play, pause, bolt, drop, heart) read better solid. */
  filled?: boolean;
}

export function Icon({ name, size = 20, className, style, filled = false }: IconProps) {
  return (
    <svg
      className={["icon", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
