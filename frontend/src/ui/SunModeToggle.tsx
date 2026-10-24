/**
 * ui/SunModeToggle.tsx — Sun mode toggle (R6.1).
 *
 * Sets a data-sun attribute on the root (handled in App) via the store. Colour
 * tokens swap in theme.css; this control is just a labelled toggle.
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { Button } from "./Button";

export function SunModeToggle() {
  const t = useT();
  const sunMode = useStore((s) => s.sunMode);
  const setSunMode = useStore((s) => s.setSunMode);

  return (
    <Button
      variant={sunMode ? "primary" : "secondary"}
      aria-pressed={sunMode}
      onClick={() => setSunMode(!sunMode)}
    >
      {sunMode ? t("sunMode.on") : t("sunMode.off")}
    </Button>
  );
}
