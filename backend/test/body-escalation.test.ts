/**
 * body-escalation.test.ts — body estimate + escalation reducer (R17.4).
 *   body:       Tc_model monotone in A and HR; uplift triggers only above margin
 *   escalation: all transitions with a fake clock; re-arm after REARM_DELTA;
 *               downward hysteresis
 */

import { describe, it, expect } from "vitest";
import { tcModel, pfUplift, tcUsed } from "../src/core/body.js";
import { step } from "../src/core/escalation.js";
import { escalation as esc, m, REARM_DELTA, body as bodyCfg, SNOOZE_MIN } from "../src/config.js";
import type { EscalationState } from "../contract/schemas.js";

describe("body estimate (R10, R17.4)", () => {
  it("Tc_model is monotone non-decreasing in A", () => {
    let prev = -Infinity;
    for (let A = 0; A <= 1; A += 0.1) {
      const tc = tcModel(A, 80);
      expect(tc).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = tc;
    }
  });

  it("Tc_model is monotone non-decreasing in HR", () => {
    let prev = -Infinity;
    for (let hr = bodyCfg.HR_base; hr <= 180; hr += 10) {
      const tc = tcModel(0.3, hr);
      expect(tc).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = tc;
    }
  });

  it("pf uplift triggers only when obs exceeds model by more than the margin", () => {
    const model = 37.5;
    expect(pfUplift(model + m * 0.5, model).triggered).toBe(false);
    expect(pfUplift(model + m * 0.5, model).factor).toBe(1);
    const over = pfUplift(model + m * 2, model);
    expect(over.triggered).toBe(true);
    expect(over.factor).toBeGreaterThan(1);
  });

  it("tcUsed prefers the wearable obs only when active", () => {
    expect(tcUsed({ model: 37.4, obs: 38.2, wearableOn: true })).toBe(38.2);
    expect(tcUsed({ model: 37.4, obs: 38.2, wearableOn: false })).toBe(37.4);
  });
});

describe("escalation reducer with a fake clock (R10, R17.4)", () => {
  const T0 = 1_000_000;

  it("normal -> caution at T1", () => {
    const s = step({ phase: "normal" }, esc.T1 + 0.01, T0);
    expect(s.phase).toBe("caution");
  });

  it("caution -> countdown at T2, sets a deadline", () => {
    const s = step({ phase: "caution" }, esc.T2 + 0.01, T0);
    expect(s.phase).toBe("countdown");
    expect(s.deadlineMs).toBe(T0 + esc.countdownSec * 1000);
  });

  it("countdown -> dispatch_sim on expiry", () => {
    const start: EscalationState = { phase: "countdown", deadlineMs: T0 + esc.countdownSec * 1000 };
    const before = step(start, esc.T2 + 0.5, T0 + 1000);
    expect(before.phase).toBe("countdown");
    const after = step(start, esc.T2 + 0.5, T0 + esc.countdownSec * 1000 + 1);
    expect(after.phase).toBe("dispatch_sim");
  });

  it("countdown -> snoozed on cancel; records tcAtSnooze and snoozeUntil", () => {
    const start: EscalationState = { phase: "countdown", deadlineMs: T0 + 60000 };
    const s = step(start, esc.T2 + 0.2, T0 + 5000, "cancel");
    expect(s.phase).toBe("snoozed");
    expect(s.tcAtSnooze).toBeCloseTo(esc.T2 + 0.2, 6);
    expect(s.snoozeUntilMs).toBe(T0 + 5000 + SNOOZE_MIN * 60 * 1000);
  });

  it("snoozed -> countdown only after tcUsed rises by REARM_DELTA", () => {
    const snoozeAt = esc.T2;
    const start: EscalationState = {
      phase: "snoozed",
      tcAtSnooze: snoozeAt,
      snoozeUntilMs: T0 + 10 * 60 * 1000, // far future so the timer doesn't fire
    };
    // Below the re-arm delta: stays snoozed.
    const stay = step(start, snoozeAt + REARM_DELTA * 0.5, T0 + 1000);
    expect(stay.phase).toBe("snoozed");
    // At/above the re-arm delta: re-arms.
    const rearm = step(start, snoozeAt + REARM_DELTA, T0 + 1000);
    expect(rearm.phase).toBe("countdown");
  });

  it("snoozed -> countdown when the snooze timer expires", () => {
    const start: EscalationState = {
      phase: "snoozed",
      tcAtSnooze: esc.T2,
      snoozeUntilMs: T0 + 1000,
    };
    const s = step(start, esc.T2, T0 + 2000); // past the timer
    expect(s.phase).toBe("countdown");
  });

  it("downward hysteresis: steps to normal only below T1 - hysteresis", () => {
    const start: EscalationState = { phase: "caution" };
    const justUnderT1 = step(start, esc.T1 - esc.hysteresis * 0.5, T0);
    expect(justUnderT1.phase).toBe("caution"); // not far enough down
    const wellUnder = step(start, esc.T1 - esc.hysteresis - 0.01, T0);
    expect(wellUnder.phase).toBe("normal");
  });

  it("dispatch_sim is terminal", () => {
    expect(step({ phase: "dispatch_sim" }, esc.T2, T0).phase).toBe("dispatch_sim");
  });
});
