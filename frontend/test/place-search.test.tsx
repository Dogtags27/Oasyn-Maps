/**
 * place-search.test.tsx — start/destination search box (mock mode).
 *
 * Covers the regression where search showed "No matching places." for every
 * query (empty layers), plus keyboard selection and the min-length hint.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { PlaceSearch } from "@/ui/PlaceSearch";
import { ApiClient } from "@/api/client";
import { resolveLayerSample } from "@/api/mock";
import { renderWithProviders } from "./helpers";

describe("mock layer resolution", () => {
  it("serves the per-layer sample, not the empty generic fixture", () => {
    const places = resolveLayerSample<{ name: string; features: unknown[] }>("places");
    expect(places.name).toBe("places");
    expect(places.features.length).toBeGreaterThan(0);
  });
});

describe("ApiClient.search (mock)", () => {
  it("returns schema-valid matches from the sample layers", async () => {
    const res = await new ApiClient({ mode: "mock" }).search("sample");
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results.every((r) => r.name.toLowerCase().includes("sample"))).toBe(true);
  });
});

describe("PlaceSearch", () => {
  it("lists matches as you type and picks one with the keyboard", async () => {
    const onPick = vi.fn();
    renderWithProviders(<PlaceSearch label="Start" onPick={onPick} />);
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Sample" } });

    const options = await screen.findAllByRole("option", {}, { timeout: 2000 });
    expect(options.length).toBeGreaterThan(0);
    expect(input).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onPick).toHaveBeenCalledTimes(1);
    const [at, name] = onPick.mock.calls[0]!;
    expect(typeof at.lat).toBe("number");
    expect(name).toMatch(/Sample/);
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    expect(input).toHaveValue(name);
  });

  it("asks for more letters before searching", () => {
    renderWithProviders(<PlaceSearch label="Start" onPick={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "s" } });
    expect(screen.getByRole("status")).toHaveTextContent("Type at least 2 letters.");
  });

  it("says so when nothing matches", async () => {
    renderWithProviders(<PlaceSearch label="Start" onPick={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzz" } });
    await waitFor(
      () => expect(screen.getByRole("status")).toHaveTextContent("No matching places."),
      { timeout: 2000 },
    );
  });
});
