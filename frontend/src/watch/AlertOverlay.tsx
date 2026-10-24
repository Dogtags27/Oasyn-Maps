/**
 * watch/AlertOverlay.tsx — full-screen watch alert (R8.5).
 *
 * Interrupts any view with Switch / Keep actions and a haptic-pattern label.
 * navigator.vibrate is called only when on a phone (coarse pointer + vibrate
 * support), never on desktop. Driven by a store offer so it stays in sync.
 */
import { useEffect } from "react";
import { useLocale } from "@/i18n/useLocale";
import { Button } from "@/ui/Button";
import type { OfferT } from "@/api/types";

export interface AlertOverlayProps {
  offer: OfferT;
  onSwitch: () => void;
  onKeep: () => void;
}

function isPhone(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
}

export function AlertOverlay({ offer, onSwitch, onKeep }: AlertOverlayProps) {
  const { t, d } = useLocale();
  const pattern = offer.kind === "break" ? "200 100 200" : "150";

  useEffect(() => {
    if (isPhone()) {
      navigator.vibrate?.(pattern.split(" ").map(Number));
    }
  }, [pattern]);

  return (
    <div className="watch-alert" role="alertdialog" aria-labelledby="watch-alert-title">
      <p id="watch-alert-title" className="watch-alert__title">
        {d(offer.trigger)}
      </p>
      <span className="watch-alert__haptic mono">{t("watch.haptic", { pattern })}</span>
      <div className="watch-alert__actions">
        <Button variant="primary" onClick={onSwitch}>
          {t("action.switch")}
        </Button>
        <Button variant="secondary" onClick={onKeep}>
          {t("action.keep")}
        </Button>
      </div>
    </div>
  );
}
