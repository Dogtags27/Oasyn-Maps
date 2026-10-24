/**
 * i18n/formatters.ts — Intl wrappers (R12.4).
 *
 * Numbers, durations, temperature, distance, and time all go through Intl, with
 * C/F and metric/imperial toggles supplied by prefs. No format string is ever
 * hand-written in a component.
 */

export type TempUnit = "C" | "F";
export type DistanceUnit = "metric" | "imperial";

export interface FormatOptions {
  locale: string;
  tempUnit: TempUnit;
  distanceUnit: DistanceUnit;
}

/** Plain number with the locale's grouping / decimal conventions. */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** A whole-minute duration label, e.g. "12 min" / "12 min". */
export function formatMinutes(minutes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(minutes);
}

/** Duration from seconds, rounded to minutes. */
export function formatDurationSec(seconds: number, locale: string): string {
  return formatMinutes(Math.round(seconds / 60), locale);
}

/** Temperature with unit conversion from the canonical Celsius value. */
export function formatTemp(celsius: number, opts: FormatOptions, fractionDigits = 1): string {
  const value = opts.tempUnit === "F" ? celsius * (9 / 5) + 32 : celsius;
  const unit = opts.tempUnit === "F" ? "fahrenheit" : "celsius";
  return new Intl.NumberFormat(opts.locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/** Distance from metres, switching unit system and scaling km/mi above 1000. */
export function formatDistance(metres: number, opts: FormatOptions): string {
  if (opts.distanceUnit === "imperial") {
    const feet = metres * 3.28084;
    if (feet >= 5280) {
      return new Intl.NumberFormat(opts.locale, {
        style: "unit",
        unit: "mile",
        unitDisplay: "short",
        maximumFractionDigits: 1,
      }).format(feet / 5280);
    }
    return new Intl.NumberFormat(opts.locale, {
      style: "unit",
      unit: "foot",
      unitDisplay: "short",
      maximumFractionDigits: 0,
    }).format(feet);
  }
  if (metres >= 1000) {
    return new Intl.NumberFormat(opts.locale, {
      style: "unit",
      unit: "kilometer",
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(metres / 1000);
  }
  return new Intl.NumberFormat(opts.locale, {
    style: "unit",
    unit: "meter",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(metres);
}

/** Percentage, 0–100 in, rendered 0–100%. */
export function formatPercent(pct: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(pct / 100);
}

/** A time of day from an ISO timestamp. */
export function formatTime(iso: string, locale: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}
