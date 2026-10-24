/**
 * api/usePlan.ts — drive /api/plan from the store (R5.3, R5.6, R5.8).
 *
 * Builds a PlanRequest from the current start/goal/mode/scenario, calls the
 * client, and writes routes + offers + no-path into the store. Stale responses
 * are dropped inside the client (request-id per channel); here we ignore the
 * StaleResponseError. On no path we keep prior routes and set a flag (R5.6).
 *
 * The channel runs in whatever mode the client is in: mock on the sample seed at
 * hour 1, live /api/plan after Checkpoint 1 (an env-only switch).
 */
import { useCallback } from "react";
import { useClient } from "./useClient";
import { StaleResponseError } from "./client";
import { useStore } from "@/store";

export function usePlan() {
  const client = useClient();
  const setPlanning = useStore((s) => s.setPlanning);
  const setRoutes = useStore((s) => s.setRoutes);
  const setNoPath = useStore((s) => s.setNoPath);
  const setOffers = useStore((s) => s.setOffers);
  const setLoadFailed = useStore((s) => s.setLoadFailed);
  const setWeatherFellBack = useStore((s) => s.setWeatherFellBack);

  return useCallback(async () => {
    const { start, goal, mode, scenario } = useStore.getState();
    if (!start || !goal) return;

    setPlanning(true);
    try {
      const res = await client.plan({ from: start, to: goal, mode, scenario });
      // A backend warning descriptor flags the Heatwave weather fallback (R15.1).
      setWeatherFellBack(res.warning?.key === "weather.fallback.heatwave");
      setLoadFailed(false);
      if (res.noPath) {
        // Keep prior routes; surface an inline notice (R5.6).
        setNoPath(true);
        setOffers(res.offers);
        return;
      }
      setRoutes(res.routes, res.recommendedId);
      setOffers(res.offers);
    } catch (err) {
      if (err instanceof StaleResponseError) return; // superseded, ignore
      // Other failures: keep prior state and surface a retry notice (R15.2).
      setLoadFailed(true);
    } finally {
      setPlanning(false);
    }
  }, [client, setPlanning, setRoutes, setNoPath, setOffers, setLoadFailed, setWeatherFellBack]);
}
