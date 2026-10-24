/**
 * routecard.test.tsx — RouteCard renders values from the response and config,
 * not literals, and selecting it calls back (R5.4, R5.8).
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteCard } from "@/ui/RouteCard";
import { renderWithLocale } from "./helpers";
import type { RouteResultT } from "@/api/types";

const route: RouteResultT = {
  id: "r1",
  mode: "coolest",
  geometry: [
    { lat: 42.348, lng: -71.081 },
    { lat: 42.3398, lng: -71.0892 },
  ],
  timeSec: 720,
  distanceM: 980,
  heatMinutes: 5,
  shadePct: 58,
  arrivalBand: "low",
  safetyMax: 0.15,
  oases: [
    {
      id: "o1",
      at: { lat: 42.344, lng: -71.085 },
      name: { key: "oasis.cooling", vars: { name: "Sample Cooling Center" } },
      kind: "cooling",
      distanceM: 40,
      simulated: true,
    },
  ],
  j: 0.8,
  feasible: true,
  turns: [],
  aTrace: [[0, 0, 0.2]],
  explanations: [{ key: "route.explain.shadeDiff", vars: { pct: 42 } }],
};

describe("RouteCard", () => {
  it("renders the mode label and an explanation descriptor", () => {
    renderWithLocale(
      <RouteCard route={route} selected recommended onSelect={() => {}} />,
    );
    expect(screen.getByText(/Coolest/)).toBeInTheDocument();
    expect(screen.getByText(/shade about 42% more/i)).toBeInTheDocument();
  });

  it("shows the oasis count from the response", () => {
    renderWithLocale(
      <RouteCard route={route} selected={false} recommended={false} onSelect={() => {}} />,
    );
    // one oasis in the fixture
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls onSelect when activated", async () => {
    const onSelect = vi.fn();
    renderWithLocale(
      <RouteCard route={route} selected={false} recommended={false} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByRole("button", { pressed: false }));
    expect(onSelect).toHaveBeenCalledWith("r1");
  });
});
