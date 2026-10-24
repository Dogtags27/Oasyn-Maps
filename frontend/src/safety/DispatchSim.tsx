/**
 * safety/DispatchSim.tsx — the simulated dispatch preview (R9.6, R14.2).
 *
 * Shown if the critical countdown expires without cancel. A permanent plum
 * "SIMULATION: no call was placed" banner. Lists exactly what a real dispatch
 * WOULD share: the pseudonymous on-device id, the modeled temperature with its
 * range, and the location. Makes NO network request — this component only reads
 * store state and renders.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { formatTemp, type FormatOptions } from "@/i18n/formatters";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import type { BodyResponseT, LatLngT } from "@/api/types";

export interface DispatchSimProps {
  body: BodyResponseT | null;
  location: LatLngT | null;
  onClose: () => void;
}

export function DispatchSim({ body, location, onClose }: DispatchSimProps) {
  const { t } = useLocale();
  const uid = useStore((s) => s.uid);
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  const tempText = body
    ? `${formatTemp(body.tcUsed, fmt)} (${formatTemp(body.rangeLow, fmt)} – ${formatTemp(
        body.rangeHigh,
        fmt,
      )})`
    : "";
  const locText = location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "";

  return (
    <div className="dispatch-sim" role="dialog" aria-labelledby="dispatch-title" aria-modal="true">
      <div className="dispatch-sim__banner">
        <Badge kind="simulated" label={t("badge.simulated")} />
        <strong>{t("dispatch.banner")}</strong>
      </div>
      <h1 id="dispatch-title">{t("dispatch.title")}</h1>
      <p>{t("dispatch.wouldShare")}</p>
      <dl className="dispatch-sim__fields">
        <div>
          <dt>{t("dispatch.field.id")}</dt>
          <dd className="mono">{uid}</dd>
        </div>
        <div>
          <dt>{t("dispatch.field.temp")}</dt>
          <dd className="mono">{tempText}</dd>
        </div>
        <div>
          <dt>{t("dispatch.field.location")}</dt>
          <dd className="mono">{locText}</dd>
        </div>
      </dl>
      <Button variant="primary" onClick={onClose}>
        {t("action.close")}
      </Button>
    </div>
  );
}
