/**
 * offercard.test.tsx — Accept calls back; Not now snoozes that kind (R9.1, R9.2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfferCard } from "@/safety/OfferCard";
import { useStore } from "@/store";
import { renderWithLocale } from "./helpers";
import type { OfferT } from "@/api/types";

const offer: OfferT = {
  kind: "reroute",
  deltaTimeSec: 40,
  deltaHeatMinutes: -3,
  deltaJ: -0.1,
  trigger: { key: "offer.reroute.trigger", vars: { deltaHeatMin: 3 } },
  expiryMs: Date.now() + 60_000,
  snoozeKey: "reroute",
  priority: "normal",
  routeId: "r2",
};

describe("OfferCard", () => {
  beforeEach(() => {
    useStore.setState({
      offers: [offer],
      snoozeUntil: {},
      config: { SNOOZE_MIN: 5 },
    });
  });

  it("calls onAccept with the offer", async () => {
    const onAccept = vi.fn();
    renderWithLocale(<OfferCard offer={offer} onAccept={onAccept} />);
    await userEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith(offer);
  });

  it("snoozes the offer kind on Not now", async () => {
    renderWithLocale(<OfferCard offer={offer} onAccept={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /not now/i }));
    const { snoozeUntil, offers } = useStore.getState();
    expect(snoozeUntil.reroute).toBeGreaterThan(Date.now());
    expect(offers.find((o) => o.snoozeKey === "reroute")).toBeUndefined();
  });

  it("shows a visible expiry countdown", () => {
    renderWithLocale(<OfferCard offer={offer} onAccept={() => {}} />);
    expect(screen.getByText(/Expires in/i)).toBeInTheDocument();
  });
});
