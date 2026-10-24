/**
 * watch/views/WatchFace.tsx — the home watch face (R8.2, R8.7).
 *
 * A modular smartwatch face: the date in the accent colour, large rounded
 * digital time, a small exposure complication, and three circular
 * complications along the bottom:
 *   - heart rate: the scenario HR, with a heart that beats at that rate;
 *   - body temperature: the modeled core estimate from /api/body (an
 *     illustrative model, never a measurement), as a gauge coloured by band;
 *   - steps: steps walked so far on the selected route (walked distance over a
 *     typical stride), as an activity-style ring against the trip's total.
 * Heart rate and steps are simulated, so the face carries a SIMULATED marker
 * (R15.3). Values are formatted via Intl; nothing here is diagnostic.
 */
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { useClient } from "@/api/useClient";
import { viewConfig, bandForExposure } from "@/config";
import { formatNumber, formatTemp, type FormatOptions } from "@/i18n/formatters";
import type { BodyResponseT } from "@/api/types";
import { useClock } from "../useClock";

/** Typical adult walking stride used to turn walked distance into steps. */
const STRIDE_M = 0.75;
/** Gauge range for the body-temperature complication, deg C. */
const TEMP_MIN_C = 35;
const TEMP_MAX_C = 40;
/** Wait for slider/playback changes to settle before re-estimating. */
const BODY_DEBOUNCE_MS = 600;

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;
/** The temperature gauge is a 270-degree arc opening at the bottom. */
const ARC_FRAC = 0.75;

function useBodyEstimate(): BodyResponseT | null {
  const client = useClient();
  const a = useStore((s) => s.a);
  const hr = useStore((s) => s.scenario.hr ?? 70);
  const [body, setBody] = useState<BodyResponseT | null>(null);
  useEffect(() => {
    let active = true;
    const id = setTimeout(() => {
      client
        .body({ a, hr, wearableOn: false })
        .then((res) => active && setBody(res))
        .catch(() => {
          /* the face shows a dash when no estimate is available */
        });
    }, BODY_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [client, a, hr]);
  return body;
}

const BAND_TONE: Record<string, string> = {
  low: "necklace",
  elevated: "amber",
  high: "brick",
};

export function WatchFace() {
  const { t } = useLocale();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const scenarioHr = useStore((s) => s.scenario.hr);
  const a = useStore((s) => s.a);
  const progress = useStore((s) => s.progress);
  const config = useStore((s) => s.config);
  const route = useSelectedRoute();
  const cfg = viewConfig(config);
  // Same fallback as the Body view: the configured resting baseline.
  const baseline = (cfg.raw as { body?: { HR_base?: number } }).body?.HR_base ?? 70;
  const hr = scenarioHr ?? baseline;
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };
  const clock = useClock(locale);
  const body = useBodyEstimate();

  // Steps walked on the current trip, against the trip's total.
  const totalSteps = route ? Math.round(route.distanceM / STRIDE_M) : 0;
  const steps = Math.round(totalSteps * Math.max(0, Math.min(1, progress)));
  const stepsFrac = totalSteps > 0 ? steps / totalSteps : 0;

  // Body temperature gauge position and tone.
  const tc = body?.tcUsed ?? null;
  const tempFrac =
    tc === null ? 0 : Math.max(0, Math.min(1, (tc - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C)));
  const tempTone = BAND_TONE[body?.band ?? "low"] ?? "necklace";
  const tempText = tc === null ? "\u2014" : formatTemp(tc, fmt, 1).replace(/\s?[°º]?[CF]$/, "°");

  // Small exposure complication.
  const band = bandForExposure(a, cfg.bands);
  const expFrac = Math.max(0, Math.min(1, a));

  // The heart beats at the displayed rate.
  const beatSec = 60 / Math.max(30, hr);

  return (
    <div className="wface" aria-label={clock.longDate}>
      <div className="wface__top">
        <span className="wface__date">
          <span className="wface__weekday">{clock.weekday}</span>
          <span className="wface__day">{clock.day}</span>
        </span>
        <span className={`wface__exposure wface__exposure--${BAND_TONE[band]}`} aria-label={t("watch.exposureRing")}>
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="10" fill="none" stroke="var(--watch-track)" strokeWidth="3" />
            <circle
              cx="13"
              cy="13"
              r="10"
              fill="none"
              stroke={`var(--watch-${BAND_TONE[band]})`}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 10 * expFrac} ${2 * Math.PI * 10}`}
              transform="rotate(-90 13 13)"
            />
          </svg>
        </span>
      </div>

      <time className="wface__time" dateTime={clock.now.toISOString()}>
        {clock.time}
      </time>

      <ul className="wface__comps">
        {/* Heart rate */}
        <li className="wcomp wcomp--heart" aria-label={`${t("wearable.hr")} ${formatNumber(hr, locale)}`}>
          <span className="wcomp__dial">
            <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
              <circle cx="27" cy="27" r={RING_R} fill="var(--watch-surface)" />
              <circle cx="27" cy="27" r={RING_R} fill="none" stroke="var(--watch-red-track)" strokeWidth="4" />
            </svg>
            <span className="wcomp__inner">
              <svg
                className="wcomp__heart"
                width="13"
                height="12"
                viewBox="0 0 24 22"
                aria-hidden="true"
                style={{ animationDuration: `${beatSec}s` }}
              >
                <path
                  d="M12 21.5S1 14.6 1 7.2A6 6 0 0 1 12 3.9a6 6 0 0 1 11 3.3c0 7.4-11 14.3-11 14.3z"
                  fill="var(--watch-brick)"
                />
              </svg>
              <span className="wcomp__value">{formatNumber(hr, locale)}</span>
            </span>
          </span>
          <span className="wcomp__label">{t("watch.bpm")}</span>
        </li>

        {/* Body temperature (modeled) */}
        <li className={`wcomp wcomp--temp wcomp--${tempTone}`} aria-label={`${t("watch.temp")} ${tempText}`}>
          <span className="wcomp__dial">
            <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
              <circle cx="27" cy="27" r={RING_R} fill="var(--watch-surface)" />
              <circle
                cx="27"
                cy="27"
                r={RING_R}
                fill="none"
                stroke="var(--watch-track)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${RING_C * ARC_FRAC} ${RING_C}`}
                transform="rotate(135 27 27)"
              />
              <circle
                className="wcomp__arc"
                cx="27"
                cy="27"
                r={RING_R}
                fill="none"
                stroke={`var(--watch-${tempTone})`}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${RING_C * ARC_FRAC * tempFrac} ${RING_C}`}
                transform="rotate(135 27 27)"
              />
            </svg>
            <span className="wcomp__inner">
              <svg width="10" height="13" viewBox="0 0 12 20" aria-hidden="true">
                <path
                  d="M4 3a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z"
                  fill="none"
                  stroke={`var(--watch-${tempTone})`}
                  strokeWidth="1.8"
                />
                <circle cx="6" cy="15.5" r="2" fill={`var(--watch-${tempTone})`} />
              </svg>
              <span className="wcomp__value">{tempText}</span>
            </span>
          </span>
          <span className="wcomp__label">{t("watch.temp")}</span>
        </li>

        {/* Steps */}
        <li className="wcomp wcomp--steps" aria-label={`${t("watch.steps")} ${formatNumber(steps, locale)}`}>
          <span className="wcomp__dial">
            <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
              <circle cx="27" cy="27" r={RING_R} fill="var(--watch-surface)" />
              <circle cx="27" cy="27" r={RING_R} fill="none" stroke="var(--watch-green-track)" strokeWidth="4" />
              <circle
                className="wcomp__arc"
                cx="27"
                cy="27"
                r={RING_R}
                fill="none"
                stroke="var(--watch-necklace)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${RING_C * stepsFrac} ${RING_C}`}
                transform="rotate(-90 27 27)"
              />
            </svg>
            <span className="wcomp__inner">
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 2c2 0 3 2.2 3 5s-1 5-3 5s-3-2-3-5s1-5 3-5zM6 14h4v2.5a2 2 0 0 1-4 0zM16 6c2 0 3 2.2 3 5s-1 5-3 5s-3-2-3-5s1-5 3-5zM14 18h4v2a2 2 0 0 1-4 0z"
                  fill="var(--watch-necklace)"
                />
              </svg>
              <span className="wcomp__value">{formatNumber(steps, locale)}</span>
            </span>
          </span>
          <span className="wcomp__label">{t("watch.steps")}</span>
        </li>
      </ul>

      <span className="wface__sim">{t("badge.simulated")}</span>
    </div>
  );
}
