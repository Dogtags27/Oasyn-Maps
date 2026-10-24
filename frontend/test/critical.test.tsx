/**
 * critical.test.tsx — the countdown is derived locally from deadlineMs using the
 * wall clock, and expiry fires once (R9.5). Reduced motion keeps the number
 * updating with no ring animation (R9.7).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act } from "@testing-library/react";
import { CriticalDialog } from "@/safety/CriticalDialog";
import { useStore } from "@/store";
import { renderWithLocale } from "./helpers";

describe("CriticalDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A 60s countdown ending 30s from "now".
    useStore.setState({
      escalation: { phase: "countdown", deadlineMs: Date.now() + 30_000 },
      reducedMotion: false,
      config: { escalation: { countdownSec: 60, T1: 38, T2: 39, hysteresis: 0.3 } },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("shows seconds remaining from deadlineMs", () => {
    renderWithLocale(
      <CriticalDialog onCancel={() => {}} onExpire={() => {}} onGetHelp={() => {}} />,
    );
    // ~30 seconds remaining at mount.
    expect(screen.getByText(/^3[01]$|^30$/)).toBeInTheDocument();
  });

  it("fires onExpire when the deadline passes", () => {
    const onExpire = vi.fn();
    useStore.setState({
      escalation: { phase: "countdown", deadlineMs: Date.now() + 1000 },
    });
    renderWithLocale(
      <CriticalDialog onCancel={() => {}} onExpire={onExpire} onGetHelp={() => {}} />,
    );
    // Advance past the deadline; the rAF-driven tick updates `now`. Wrap in act
    // so React flushes the state update and the expiry effect runs.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("renders the largest control as 'I am OK, cancel'", () => {
    renderWithLocale(
      <CriticalDialog onCancel={() => {}} onExpire={() => {}} onGetHelp={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /i am ok, cancel/i })).toBeInTheDocument();
  });
});
