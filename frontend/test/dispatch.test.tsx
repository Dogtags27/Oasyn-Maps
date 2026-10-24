/**
 * dispatch.test.tsx — the simulated dispatch makes no network request and shows
 * a permanent SIMULATION banner listing the shared fields (R9.6, R14.2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { DispatchSim } from "@/safety/DispatchSim";
import { useStore } from "@/store";
import { renderWithLocale } from "./helpers";
import type { BodyResponseT } from "@/api/types";

const body: BodyResponseT = {
  tcModel: 39.2,
  tcUsed: 39.2,
  rangeLow: 38.8,
  rangeHigh: 39.6,
  band: "high",
  pfUplift: 1.5,
  label: { key: "body.label.illustrative" },
  simulated: false,
};

describe("DispatchSim", () => {
  beforeEach(() => {
    useStore.setState({ uid: "test-uid-1234" });
  });

  it("makes no network request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWithLocale(
      <DispatchSim body={body} location={{ lat: 42.34, lng: -71.08 }} onClose={() => {}} />,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows the permanent simulation banner and shared fields", () => {
    renderWithLocale(
      <DispatchSim body={body} location={{ lat: 42.34, lng: -71.08 }} onClose={() => {}} />,
    );
    expect(screen.getByText(/no call was placed/i)).toBeInTheDocument();
    expect(screen.getByText("test-uid-1234")).toBeInTheDocument();
    expect(screen.getByText(/42\.3400, -71\.0800/)).toBeInTheDocument();
  });
});
