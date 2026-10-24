/**
 * api/useEscalation.ts — drive /api/body and /api/escalation/step (R9.5, R10.2, R22).
 *
 * Posts the current exposure + HR to /api/body for the estimate, then steps the
 * escalation reducer on the backend with the returned tcUsed. The reducer phase
 * (normal / caution / countdown / dispatch_sim) comes entirely from the backend;
 * the frontend only renders it and runs the local wall-clock countdown. These
 * channels are live after Checkpoint 2 (env-only; mock falls back to the seed).
 */
import { useCallback } from "react";
import { useClient } from "./useClient";
import { useStore } from "@/store";
import type { BodyResponseT } from "@/api/types";

export function useEscalation() {
  const client = useClient();
  const setEscalation = useStore((s) => s.setEscalation);

  /** Fetch the modeled body estimate for the current A/HR. */
  const estimateBody = useCallback(
    async (overrides?: { a?: number; hr?: number; tcObs?: number; wearableOn?: boolean }) => {
      const s = useStore.getState();
      const a = overrides?.a ?? s.a;
      const hr = overrides?.hr ?? s.scenario.hr ?? 70;
      const res = await client.body({
        a,
        hr,
        tcObs: overrides?.tcObs,
        wearableOn: overrides?.wearableOn ?? false,
      });
      return res;
    },
    [client],
  );

  /** Step the escalation reducer with a body estimate and an optional action. */
  const step = useCallback(
    async (body: BodyResponseT, action: "cancel" | "none" = "none") => {
      const s = useStore.getState();
      const res = await client.escalationStep({
        state: s.escalation,
        tcUsed: body.tcUsed,
        nowMs: Date.now(),
        action,
      });
      setEscalation(res.state);
      return res;
    },
    [client, setEscalation],
  );

  return { estimateBody, step };
}
