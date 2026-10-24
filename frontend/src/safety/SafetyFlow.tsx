/**
 * safety/SafetyFlow.tsx — orchestrates the escalation UI by phase (R9).
 *
 * The backend reducer owns the phase; this component renders whatever phase the
 * store holds: caution -> CautionBanner, countdown -> CriticalDialog, expiry ->
 * DispatchSim. Cancel steps the reducer with action "cancel"; expiry steps it so
 * the backend moves to dispatch_sim. The local countdown (CriticalDialog) is the
 * only wall-clock use; the phase transitions come from the backend.
 */
import { useState } from "react";
import { useStore } from "@/store";
import { useEscalation } from "@/api/useEscalation";
import { CautionBanner } from "./CautionBanner";
import { CriticalDialog } from "./CriticalDialog";
import { DispatchSim } from "./DispatchSim";
import type { BodyResponseT, LatLngT } from "@/api/types";

export interface SafetyFlowProps {
  /** The most recent body estimate (for the dispatch preview). */
  body: BodyResponseT | null;
  /** The walker/user location (for the dispatch preview). */
  location: LatLngT | null;
}

export function SafetyFlow({ body, location }: SafetyFlowProps) {
  const phase = useStore((s) => s.escalation.phase);
  const setEscalation = useStore((s) => s.setEscalation);
  const { estimateBody, step } = useEscalation();
  const [showDispatch, setShowDispatch] = useState(false);

  async function cancel() {
    const b = body ?? (await estimateBody());
    await step(b, "cancel");
    setShowDispatch(false);
  }

  async function expire() {
    // Step the reducer so the backend advances to the simulated dispatch.
    const b = body ?? (await estimateBody());
    await step(b, "none");
    setShowDispatch(true);
  }

  if (phase === "caution") return <CautionBanner />;

  if (phase === "countdown") {
    return (
      <CriticalDialog
        onCancel={() => void cancel()}
        onExpire={() => void expire()}
        onGetHelp={() => void expire()}
      />
    );
  }

  if (phase === "dispatch_sim" || showDispatch) {
    return (
      <DispatchSim
        body={body}
        location={location}
        onClose={() => {
          setShowDispatch(false);
          setEscalation({ phase: "normal" });
        }}
      />
    );
  }

  return null;
}
