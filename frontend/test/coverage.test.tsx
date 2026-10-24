/**
 * coverage.test.tsx — the Coverage tab renders the backend numbers and the
 * heuristic note descriptor (R17.2). The event-log store action appends rows.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { CoverageTab } from "@/lab/CoverageTab";
import { useStore } from "@/store";
import { renderWithProviders } from "./helpers";

describe("CoverageTab (mock mode)", () => {
  beforeEach(() => {
    useStore.setState({ config: { coverage: { suggestK: 3 } } });
  });

  it("renders within-5 and within-10 shares and the heuristic note", async () => {
    renderWithProviders(<CoverageTab />);
    // from the sample seed: 62.5% within 5, 88% within 10
    await waitFor(() => expect(screen.getByText(/63%|62\.5%|62%/)).toBeInTheDocument());
    expect(screen.getByText(/88%/)).toBeInTheDocument();
    expect(screen.getByText(/heuristic, not an official plan/i)).toBeInTheDocument();
  });
});

describe("event log", () => {
  beforeEach(() => {
    useStore.setState({ eventLog: [] });
  });

  it("appends entries with incrementing ids", () => {
    const { logEvent } = useStore.getState();
    logEvent({ triggerKey: "lab.event.heatSpike", decisionKey: "lab.decision.offered", deltaJ: -0.1, reason: null });
    logEvent({ triggerKey: "lab.event.hrSpike", decisionKey: "lab.decision.noChange", deltaJ: null, reason: null });
    const log = useStore.getState().eventLog;
    expect(log).toHaveLength(2);
    expect(log[0].id).toBe(0);
    expect(log[1].id).toBe(1);
    expect(log[1].decisionKey).toBe("lab.decision.noChange");
  });
});
