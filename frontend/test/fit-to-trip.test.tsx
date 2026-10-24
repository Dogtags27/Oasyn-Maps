/**
 * fit-to-trip.test.tsx — the map frames the trip once start + destination are set.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { Map as LeafletMap } from "leaflet";
import { MapContext } from "@/map/MapContext";
import { FitToTrip } from "@/map/FitToTrip";
import { useStore } from "@/store";
import type { RouteResultT } from "@/api/types";

function fakeMap() {
  const container = document.createElement("div");
  return {
    fitBounds: vi.fn(),
    panTo: vi.fn(),
    getContainer: () => container,
    getBounds: () => ({ pad: () => ({ contains: () => false }) }),
  };
}

const start = { lat: 42.348, lng: -71.081 };
const goal = { lat: 42.3398, lng: -71.0892 };

const route = {
  id: "r1",
  geometry: [start, { lat: 42.344, lng: -71.085 }, goal],
} as unknown as RouteResultT;

function mount(map: ReturnType<typeof fakeMap>) {
  return render(
    <MapContext.Provider value={map as unknown as LeafletMap}>
      <FitToTrip />
    </MapContext.Provider>,
  );
}

describe("FitToTrip", () => {
  beforeEach(() => {
    useStore.setState({ start: null, goal: null, routes: [], selectedId: null, reducedMotion: true });
  });

  it("frames both endpoints as soon as start and destination are set", () => {
    const map = fakeMap();
    mount(map);
    act(() => useStore.getState().setStart(start, "A"));
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.panTo).toHaveBeenCalledTimes(1); // single point off screen -> pan

    act(() => useStore.getState().setGoal(goal, "B"));
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const bounds = map.fitBounds.mock.calls[0]![0];
    expect(bounds.contains([start.lat, start.lng])).toBe(true);
    expect(bounds.contains([goal.lat, goal.lng])).toBe(true);
  });

  it("re-frames to the whole route when it arrives, once", () => {
    const map = fakeMap();
    useStore.setState({ start, goal });
    mount(map);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    act(() => useStore.getState().setRoutes([route], "r1"));
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(map.fitBounds.mock.calls[1]![1]).toMatchObject({ animate: false, maxZoom: 17 });

    // Unrelated store churn must not keep yanking the map around.
    act(() => useStore.setState({ planning: true }));
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale route from the previous trip", () => {
    const map = fakeMap();
    useStore.setState({ start, goal, routes: [route], selectedId: "r1" });
    mount(map);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    // New, far-away destination while the old route is still in the store.
    act(() => useStore.getState().setGoal({ lat: 42.4064, lng: -71.1189 }, "Tufts"));
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    const bounds = map.fitBounds.mock.calls[1]![0];
    // Framed the endpoints (start + Tufts), not the old route's goal box.
    expect(bounds.contains([42.4064, -71.1189])).toBe(true);
  });
});
