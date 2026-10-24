/**
 * safety/CriticalDialog.tsx — the full-screen critical dialog (R9.4, R9.5, R9.7).
 *
 * Paper background, brick top rule with a tick pattern, a 64px Fraunces
 * countdown number with a draining ring. The countdown is derived locally from
 * escalation.deadlineMs using the wall clock (useCountdown), so it finishes even
 * if the API goes away. "I am OK, cancel" is the largest control; "Get help now"
 * is secondary. Reduced motion: the number updates but the ring does not
 * animate. Announced assertively; the remaining time is read every 10s.
 *
 * When the countdown expires without cancel, the parent swaps in the DispatchSim.
 */
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { Button } from "@/ui/Button";
import { useCountdown } from "./useCountdown";

export interface CriticalDialogProps {
  onCancel: () => void;
  onExpire: () => void;
  onGetHelp: () => void;
}

export function CriticalDialog({ onCancel, onExpire, onGetHelp }: CriticalDialogProps) {
  const t = useT();
  const escalation = useStore((s) => s.escalation);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const totalMs = cfg.escalation.countdownSec * 1000;

  const { secondsLeft, fractionLeft, expired } = useCountdown(
    escalation.deadlineMs,
    totalMs,
    true,
  );

  // Fire expiry exactly once.
  const firedExpire = useRef(false);
  useEffect(() => {
    if (expired && !firedExpire.current) {
      firedExpire.current = true;
      onExpire();
    }
  }, [expired, onExpire]);

  // Announce the remaining time every 10 seconds (assertive region) (R13.4).
  const [announcement, setAnnouncement] = useState("");
  const lastAnnounced = useRef<number>(-1);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    if (secondsLeft % 10 === 0 && secondsLeft !== lastAnnounced.current) {
      lastAnnounced.current = secondsLeft;
      setAnnouncement(t("critical.announce", { seconds: secondsLeft }));
    }
  }, [secondsLeft, t]);

  // Draining ring geometry.
  const R = 70;
  const C = 2 * Math.PI * R;
  const dash = C * fractionLeft;

  return (
    <div
      className="critical"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="critical-title"
    >
      <div className="critical__rule" aria-hidden="true" />
      <h1 id="critical-title" className="critical__title">
        {t("critical.title")}
      </h1>

      <div className="critical__ring-wrap">
        <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface)" strokeWidth="8" />
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="var(--brick)"
            strokeWidth="8"
            strokeDasharray={`${dash} ${C}`}
            strokeLinecap="round"
            transform="rotate(-90 90 90)"
            style={reducedMotion ? undefined : { transition: "stroke-dasharray 0.25s linear" }}
          />
        </svg>
        <span className="critical__count mono">{secondsLeft}</span>
      </div>

      <p className="critical__label">{t("critical.countdownLabel")}</p>

      <div className="critical__actions">
        <Button variant="primary" className="critical__ok" onClick={onCancel}>
          {t("action.iAmOk")}
        </Button>
        <Button variant="secondary" onClick={onGetHelp}>
          {t("action.getHelp")}
        </Button>
      </div>

      <div className="visually-hidden" aria-live="assertive" role="status">
        {announcement}
      </div>
    </div>
  );
}
