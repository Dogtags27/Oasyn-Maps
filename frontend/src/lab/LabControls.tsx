/**
 * lab/LabControls.tsx — the Lab scenario controls (R7.1, R13.6).
 *
 * Sliders for air temp, humidity, cloud, time of day, safety weight, and
 * simulated HR; segmented controls for prior exposure and mode; toggles for
 * live weather and step-free; and scenario presets. Slider changes are debounced
 * (interval from config) before calling /api/plan. Ranges come from config
 * (T_lo/T_hi), never hardcoded.
 */
import { useMemo, useRef } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import { usePlan } from "@/api/usePlan";
import { usePresets } from "@/api/usePresets";
import { debounce } from "@/api/client";
import { Slider } from "@/ui/Slider";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Button } from "@/ui/Button";
import { formatTemp, formatPercent, formatTime, formatNumber, type FormatOptions } from "@/i18n/formatters";
import type { ModeT } from "@/api/types";
import type { PriorPreset } from "@/store";

export function LabControls() {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const tempUnit = useStore((s) => s.tempUnit);
  const distanceUnit = useStore((s) => s.distanceUnit);
  const fmt: FormatOptions = { locale, tempUnit, distanceUnit };

  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const prior = useStore((s) => s.prior);
  const setPrior = useStore((s) => s.setPrior);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const plan = usePlan();
  const presets = usePresets();

  // Debounce slider-driven plans by the config interval (R2.5).
  const debouncedPlan = useRef(debounce(() => void plan(), cfg.debounceMs)).current;

  const hoursToday = useMemo(() => new Date(scenario.timeISO).getHours(), [scenario.timeISO]);

  function setHour(hour: number) {
    const d2 = new Date(scenario.timeISO);
    d2.setHours(hour, 0, 0, 0);
    setScenario({ timeISO: d2.toISOString() });
    debouncedPlan();
  }

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

  return (
    <div className="lab-controls">
      <Slider
        label={t("lab.control.temp")}
        value={scenario.tempC}
        min={cfg.tempLo}
        max={cfg.tempHi}
        step={1}
        valueText={formatTemp(scenario.tempC, fmt, 0)}
        onChange={(v) => {
          setScenario({ tempC: v });
          debouncedPlan();
        }}
      />
      <Slider
        label={t("lab.control.humidity")}
        value={scenario.rh}
        min={0}
        max={100}
        step={1}
        valueText={formatPercent(scenario.rh, locale)}
        onChange={(v) => {
          setScenario({ rh: v });
          debouncedPlan();
        }}
      />
      <Slider
        label={t("lab.control.cloud")}
        value={scenario.cloud}
        min={0}
        max={1}
        step={0.05}
        valueText={formatPercent(scenario.cloud * 100, locale)}
        onChange={(v) => {
          setScenario({ cloud: v });
          debouncedPlan();
        }}
      />
      <Slider
        label={t("lab.control.time")}
        value={hoursToday}
        min={0}
        max={23}
        step={1}
        valueText={formatTime(scenario.timeISO, locale)}
        onChange={setHour}
      />
      <Slider
        label={t("lab.control.hr")}
        value={scenario.hr ?? 70}
        min={50}
        max={180}
        step={1}
        valueText={formatNumber(scenario.hr ?? 70, locale)}
        onChange={(v) => {
          setScenario({ hr: v });
          debouncedPlan();
        }}
      />

      <div className="lab-controls__group">
        <span className="lab-controls__label">{t("mode.label")}</span>
        <SegmentedControl
          ariaLabel={t("mode.label")}
          options={modeOptions}
          value={mode}
          onChange={(m) => {
            setMode(m);
            void plan();
          }}
        />
      </div>

      <div className="lab-controls__group">
        <span className="lab-controls__label">{t("trip.priorExposure")}</span>
        <SegmentedControl
          ariaLabel={t("trip.priorExposure")}
          options={priorOptions}
          value={prior}
          onChange={(p) => {
            setPrior(p);
            void plan();
          }}
        />
      </div>

      <label className="lab-controls__toggle">
        <input
          type="checkbox"
          checked={scenario.liveWeather}
          onChange={(e) => {
            setScenario({ liveWeather: e.target.checked });
            void plan();
          }}
        />
        {t("lab.control.liveWeather")}
      </label>

      <label className="lab-controls__toggle">
        <input
          type="checkbox"
          checked={scenario.stepFree}
          onChange={(e) => {
            setScenario({ stepFree: e.target.checked });
            void plan();
          }}
        />
        {t("lab.control.stepFree")}
      </label>

      {presets && presets.weather.length > 0 && (
        <div className="lab-controls__group">
          <span className="lab-controls__label">{t("lab.control.presets")}</span>
          <div className="lab-controls__presets">
            {presets.weather.map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                onClick={() => {
                  setScenario(p.scenario);
                  void plan();
                }}
              >
                {d(p.label)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
