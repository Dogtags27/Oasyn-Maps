/**
 * api/useReplan.ts — drive /api/replan during Lab playback (R7.3).
 *
 * Posts the walker position, goal, mode, and scenario to /api/replan and returns
 * the offers the backend produces. The backend decides whether to offer (past
 * the hysteresis margin or on a hard safety block); the frontend never computes
 * that. Accepting an offer switches the route; otherwise nothing changes unless
 * the default-off "simulate user accepts" toggle is on (handled by the caller).
 */
import { useCallback } from "react";
import { useClient } from "./useClient";
import { StaleResponseError } from "./client";
import { useStore } from "@/store";
import type { LatLngT, ReplanResponseT } from "@/api/types";

export function useReplan() {
  const client = useClient();
  const setOffers = useStore((s) => s.setOffers);

  return useCallback(
    async (position: LatLngT): Promise<ReplanResponseT | null> => {
      const { goal, mode, scenario, snoozeUntil } = useStore.getState();
      if (!goal) return null;
      const now = Date.now();
      const snoozed = Object.entries(snoozeUntil)
        .filter(([, until]) => until > now)
        .map(([key]) => key);
      try {
        const res = await client.replan({ goal, position, mode, scenario, snoozed });
        setOffers(res.offers);
        return res;
      } catch (err) {
        if (err instanceof StaleResponseError) return null;
        return null;
      }
    },
    [client, setOffers],
  );
}
