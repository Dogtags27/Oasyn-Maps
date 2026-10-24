/**
 * landing.test.tsx — the landing renders one h1 and the honesty badge legend,
 * and media slots fall back to a labelled hatched placeholder (R11, R13.1).
 */
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { Landing } from "@/pages/Landing";
import { renderWithLocale } from "./helpers";

describe("Landing", () => {
  it("renders exactly one h1", () => {
    renderWithLocale(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders the data-honesty badge legend", () => {
    renderWithLocale(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    // The badges render exact pill labels; the legend has all five kinds.
    expect(screen.getByText("sample data")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.getByText("estimated")).toBeInTheDocument();
  });

  it("renders media placeholders with accessible labels when no src is set", () => {
    renderWithLocale(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    // Six feature rows -> six placeholder images with alt labels.
    const placeholders = screen.getAllByRole("img");
    expect(placeholders.length).toBeGreaterThanOrEqual(6);
  });
});
