/**
 * core/escalation.ts — pure escalation reducer (R10.4-R10.7).
 *
 *   step(state, tcUsed, nowMs, action) -> nextState
 *
 * No internal timers: `nowMs` is an input, so the same inputs always yield the
 * same next state (deterministic, testable with a fake clock). The route returns
 * `deadlineMs` so the frontend can complete a countdown locally if the API goes
 * away (R10.6). `dispatch_sim` makes NO network request — it is a terminal
 * simulated state; the route attaches a descriptor of the data that would be
 * shared, permanently flagged simulated (R10.7).
 *
 * Transitions (math.md §11):
 *   normal    -> caution       when tcUsed >= T1
 *   caution   -> countdown     when tcUsed >= T2   (sets deadlineMs = now + countdown)
 *   countdown -> dispatch_sim  when now >= deadlineMs (expiry)
 *   countdown -> snoozed       on action 'cancel'  (snoozeUntil = now + SNOOZE_MIN; record tcAtSnooze)
 *   snoozed   -> countdown     when tcUsed >= tcAtSnooze + REARM_DELTA, or now >= snoozeUntilMs
 *   caution/countdown -> normal when tcUsed < T1 - hysteresis (downward hysteresis)
 */

import type { EscalationState } from "../../contract/schemas.js";
import { escalation as esc, SNOOZE_MIN, REARM_DELTA } from "../config.js";

export type EscalationAction = "cancel" | "none";

const countdownMs = esc.countdownSec * 1000;
const snoozeMs = SNOOZE_MIN * 60 * 1000;
const stepDownBelow = esc.T1 - esc.hysteresis;

/** Pure reducer: one escalation step. */
export function step(
  state: EscalationState,
  tcUsed: number,
  nowMs: number,
  action: EscalationAction = "none",
): EscalationState {
  switch (state.phase) {
    case "normal": {
      if (tcUsed >= esc.T2) {
        // Jump straight through caution if already at the countdown threshold.
        return { phase: "countdown", deadlineMs: nowMs + countdownMs };
      }
      if (tcUsed >= esc.T1) return { phase: "caution" };
      return { phase: "normal" };
    }

    case "caution": {
      if (tcUsed < stepDownBelow) return { phase: "normal" };
      if (tcUsed >= esc.T2) return { phase: "countdown", deadlineMs: nowMs + countdownMs };
      return { phase: "caution" };
    }

    case "countdown": {
      if (action === "cancel") {
        return { phase: "snoozed", snoozeUntilMs: nowMs + snoozeMs, tcAtSnooze: tcUsed };
      }
      if (tcUsed < stepDownBelow) return { phase: "normal" };
      if (state.deadlineMs !== undefined && nowMs >= state.deadlineMs) {
        return { phase: "dispatch_sim" };
      }
      // Keep counting down; preserve the existing deadline.
      return { phase: "countdown", deadlineMs: state.deadlineMs ?? nowMs + countdownMs };
    }

    case "snoozed": {
      const rearmByTemp =
        state.tcAtSnooze !== undefined && tcUsed >= state.tcAtSnooze + REARM_DELTA;
      const rearmByTimer = state.snoozeUntilMs !== undefined && nowMs >= state.snoozeUntilMs;
      if (tcUsed < stepDownBelow) return { phase: "normal" };
      if (rearmByTemp || rearmByTimer) {
        return { phase: "countdown", deadlineMs: nowMs + countdownMs };
      }
      // Preserve snooze bookkeeping.
      return {
        phase: "snoozed",
        ...(state.snoozeUntilMs !== undefined ? { snoozeUntilMs: state.snoozeUntilMs } : {}),
        ...(state.tcAtSnooze !== undefined ? { tcAtSnooze: state.tcAtSnooze } : {}),
      };
    }

    case "dispatch_sim":
      // Terminal: stays dispatched. (A fresh request resets state client-side.)
      return { phase: "dispatch_sim" };

    default:
      return { phase: "normal" };
  }
}
