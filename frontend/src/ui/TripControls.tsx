/**
 * ui/TripControls.tsx — mode + prior-exposure controls (R5.2, R5.5).
 *
 * Start and destination live in the SearchBar (R13.3's no-map-needed search).
 * Mode (Fastest safe / Balanced / Coolest) and prior exposure (Fresh / 30 / 60)
 * are keyboard-operable segmented controls whose values flow into the plan
 * request. Changing any of them re-plans when both endpoints are set.
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { SegmentedControl } from "./SegmentedControl";
import { Button } from "./Button";
import { usePlan } from "@/api/usePlan";
import type { ModeT } from "@/api/types";
import type { PriorPreset } from "@/store";

export function TripControls() {
  const t = useT();
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const prior = useStore((s) => s.prior);
  const setPrior = useStore((s) => s.setPrior);
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);
  const plan = usePlan();

  const modeOptions: { value: ModeT; label: string }[] = [
    { value: "fastest", label: t("mode.fastest") },
    { value: "balanced", label: t("mode.balanced") },
    { value: "coolest", label: t("mode.coolest") },
  ];
  const priorOptions: { value: PriorPreset; label: string }[] = [
    { value: "fresh", label: t("trip.prior.fresh") },
    { value: "30", label: t("trip.prior.30") },
    { value: "60", label: t("trip.prior.60") },
  ];

  const canPlan = Boolean(start && goal);

  return (
    <div className="trip-controls">
      <div className="trip-controls__group">
        <span className="trip-controls__label">{t("mode.label")}</span>
        <SegmentedControl
          ariaLabel={t("mode.label")}
          options={modeOptions}
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (canPlan) void plan();
          }}
        />
      </div>

      <div className="trip-controls__group">
        <span className="trip-controls__label">{t("trip.priorExposure")}</span>
        <SegmentedControl
          ariaLabel={t("trip.priorExposure")}
          options={priorOptions}
          value={prior}
          onChange={(p) => {
            setPrior(p);
            if (canPlan) void plan();
          }}
        />
      </div>

      <Button variant="primary" disabled={!canPlan} onClick={() => void plan()}>
        {t("trip.plan")}
      </Button>
    </div>
  );
}
