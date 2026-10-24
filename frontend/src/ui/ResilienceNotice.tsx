/**
 * ui/ResilienceNotice.tsx — load-failure + weather-fallback notices (R15.1, R15.2).
 *
 * loadFailed -> a notice with a Retry button that re-runs the last plan and
 * clears the flag; weatherFellBack -> a notice that the Heatwave preset was
 * substituted. Both are dismissible/clearable; prior state is kept.
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { usePlan } from "@/api/usePlan";
import { Button } from "./Button";

export function ResilienceNotice() {
  const t = useT();
  const loadFailed = useStore((s) => s.loadFailed);
  const weatherFellBack = useStore((s) => s.weatherFellBack);
  const setLoadFailed = useStore((s) => s.setLoadFailed);
  const setWeatherFellBack = useStore((s) => s.setWeatherFellBack);
  const plan = usePlan();

  if (!loadFailed && !weatherFellBack) return null;

  return (
    <div className="resilience-notice" role="status">
      {weatherFellBack && (
        <div className="resilience-notice__row">
          <span>{t("weather.fallback.heatwave")}</span>
          <Button variant="secondary" onClick={() => setWeatherFellBack(false)}>
            {t("action.dismiss")}
          </Button>
        </div>
      )}
      {loadFailed && (
        <div className="resilience-notice__row">
          <span>{t("notice.loadFailed")}</span>
          <Button
            variant="secondary"
            onClick={() => {
              setLoadFailed(false);
              void plan();
            }}
          >
            {t("action.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
