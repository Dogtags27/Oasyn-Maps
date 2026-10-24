/**
 * i18n.test.ts — t() behaviour: interpolation, plurals, and descriptor rendering
 * (R12.3). Parity across locales is covered by scripts/i18n-check.mjs.
 */
import { describe, it, expect } from "vitest";
import { makeT } from "@/i18n/t";

describe("t()", () => {
  it("interpolates {var}", () => {
    const t = makeT({ "x.y": "Shade {pct}% more." }, "en");
    expect(t("x.y", { pct: 42 })).toBe("Shade 42% more.");
  });

  it("renders a visible marker for a missing key", () => {
    const t = makeT({}, "en");
    expect(t("nope.key")).toContain("nope.key");
  });

  it("selects plural forms for en", () => {
    const t = makeT({ "n_one": "{count} min", "n_other": "{count} mins" }, "en");
    expect(t("n", { count: 1 })).toBe("1 min");
    expect(t("n", { count: 3 })).toBe("3 mins");
  });

  it("uses other-only for ja", () => {
    const t = makeT({ "n_other": "{count} 分" }, "ja");
    expect(t("n", { count: 1 })).toBe("1 分");
    expect(t("n", { count: 5 })).toBe("5 分");
  });
});
