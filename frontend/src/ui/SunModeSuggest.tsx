/**
 * ui/SunModeSuggest.tsx — auto-suggest Sun mode in bright sun (R6.1).
 *
 * When the modeled sun elevation exceeds the configured threshold
 * (config.sunElevationSuggestDeg, with a safe default) and Sun mode is off, we
 * offer it via a dismissible notice — never forcing the swap. Sun position is
 * display-only (see map/sun.ts).
 */
import { useMemo, useState } from "react";
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { sunPosition } from "@/map/sun";
import { Button } from "./Button";

export function SunModeSuggest() {
  const t = useT();
  const sunMode = useStore((s) => s.sunMode);
  const setSunMode = useStore((s) => s.setSunMode);
  const timeISO = useStore((s) => s.scenario.timeISO);
  const config = useStore((s) => s.config);
  const [dismissed, setDismissed] = useState(false);

  const cfg = viewConfig(config);
  const raw = cfg.raw as { sunElevationSuggestDeg?: number };
  const threshold =
    typeof raw.sunElevationSuggestDeg === "number" ? raw.sunElevationSuggestDeg : 45;

  const elevation = useMemo(
    () => sunPosition(new Date(timeISO), cfg.center.lat, cfg.center.lon).elevation,
    [timeISO, cfg.center.lat, cfg.center.lon],
  );

  if (sunMode || dismissed || elevation <= threshold) return null;

  return (
    <div className="sun-suggest" role="status">
      <span>{t("sunMode.suggest")}</span>
      <div className="sun-suggest__actions">
        <Button variant="primary" onClick={() => setSunMode(true)}>
          {t("sunMode.toggle")}
        </Button>
        <Button variant="secondary" onClick={() => setDismissed(true)}>
          {t("action.dismiss")}
        </Button>
      </div>
    </div>
  );
}
