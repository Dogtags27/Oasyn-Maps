/**
 * directions.test.tsx — the screen-reader directions list renders turn
 * descriptors for the selected route (R13.2).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { DirectionsList } from "@/a11y/DirectionsList";
import { useStore } from "@/store";
import { renderWithLocale } from "./helpers";
import type { RouteResultT } from "@/api/types";

const route: RouteResultT = {
  id: "r1",
  mode: "balanced",
  geometry: [
    { lat: 42.348, lng: -71.081 },
    { lat: 42.3398, lng: -71.0892 },
  ],
  timeSec: 600,
  distanceM: 800,
  heatMinutes: 4,
  shadePct: 60,
  arrivalBand: "low",
  safetyMax: 0.1,
  oases: [],
  j: 0.5,
  feasible: true,
  turns: [
    {
      at: { lat: 42.348, lng: -71.081 },
      descriptor: { key: "turn.depart", vars: { street: "Sample St" } },
      bearingDelta: 0,
    },
    { at: { lat: 42.3398, lng: -71.0892 }, descriptor: { key: "turn.arrive" }, bearingDelta: 0 },
  ],
  aTrace: [
    [0, 0, 0.2],
    [600, 800, 0.3],
  ],
  explanations: [],
};

describe("DirectionsList", () => {
  beforeEach(() => {
    useStore.setState({ routes: [route], selectedId: "r1" });
  });

  it("renders a turn for each instruction, rendered from descriptors", () => {
    renderWithLocale(<DirectionsList />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // turn.depart interpolates the street name from vars.
    expect(screen.getByText(/Sample St/)).toBeInTheDocument();
    // turn.arrive has no vars and renders its sentence.
    expect(screen.getByText(/Arrive at your destination/)).toBeInTheDocument();
  });

  it("renders nothing when no route is selected", () => {
    useStore.setState({ routes: [], selectedId: null });
    const { container } = renderWithLocale(<DirectionsList />);
    expect(container).toBeEmptyDOMElement();
  });
});
