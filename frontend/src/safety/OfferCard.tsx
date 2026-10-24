/**
 * safety/OfferCard.tsx — a consent-based offer (R9.1, R9.2).
 *
 * Shows the backend-computed cost/benefit (delta time, delta heat) rendered via
 * t(), equal-weight Accept / Not now buttons (48px), and a visible live expiry
 * countdown. No silent auto-dismiss. "Not now" snoozes that offer kind for the
 * config SNOOZE_MIN window. The route changes ONLY on Accept — never silently.
 */
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { formatDurationSec, formatMinutes } from "@/i18n/formatters";
import { Button } from "@/ui/Button";
import type { OfferT } from "@/api/types";

export interface OfferCardProps {
  offer: OfferT;
  onAccept: (offer: OfferT) => void;
}

export function OfferCard({ offer, onAccept }: OfferCardProps) {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const config = useStore((s) => s.config);
  const snoozeKind = useStore((s) => s.snoozeKind);
  const cfg = viewConfig(config);

  // Live expiry countdown, recomputed every second from the absolute expiryMs.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((offer.expiryMs - now) / 1000));

  const notNow = () => snoozeKind(offer.snoozeKey, Date.now() + cfg.snoozeMin * 60 * 1000);

  return (
    <article
      className={`offer-card offer-card--${offer.priority}`}
      role="group"
      aria-label={d(offer.trigger)}
    >
      <p className="offer-card__trigger">{d(offer.trigger)}</p>
      <dl className="offer-card__cost">
        <div>
          <dt>{t("route.metric.time")}</dt>
          <dd className="mono">{formatDurationSec(Math.abs(offer.deltaTimeSec), locale)}</dd>
        </div>
        <div>
          <dt>{t("route.metric.heatMin")}</dt>
          <dd className="mono">{formatMinutes(Math.abs(offer.deltaHeatMinutes), locale)}</dd>
        </div>
      </dl>
      <p className="offer-card__expiry mono" aria-live="off">
        {t("offer.expiresIn", { seconds: secondsLeft })}
      </p>
      <div className="offer-card__actions">
        <Button variant="primary" onClick={() => onAccept(offer)}>
          {t("action.accept")}
        </Button>
        <Button variant="secondary" onClick={notNow}>
          {t("action.notNow")}
        </Button>
      </div>
    </article>
  );
}
