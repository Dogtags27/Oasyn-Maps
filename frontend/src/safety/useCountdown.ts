/**
 * safety/useCountdown.ts — a local countdown derived from an absolute deadline
 * using the WALL CLOCK (R9.5).
 *
 * The countdown is computed from Date.now() against the backend-supplied
 * deadlineMs, so it keeps counting and finishes even if the API becomes
 * unavailable. It uses real time, never playback time. The hook returns the
 * whole seconds remaining and a 0..1 fraction remaining (for the draining ring).
 */
import { useEffect, useState } from "react";

export interface CountdownState {
  secondsLeft: number;
  fractionLeft: number;
  expired: boolean;
}

/** Tick interval for the countdown readout; the ring animates via CSS between ticks. */
const TICK_MS = 250;

export function useCountdown(
  deadlineMs: number | undefined,
  totalMs: number,
  active: boolean,
): CountdownState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || deadlineMs === undefined) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [active, deadlineMs]);

  if (deadlineMs === undefined) {
    return { secondsLeft: 0, fractionLeft: 0, expired: false };
  }
  const remainingMs = Math.max(0, deadlineMs - now);
  return {
    secondsLeft: Math.ceil(remainingMs / 1000),
    fractionLeft: totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0,
    expired: remainingMs <= 0,
  };
}
