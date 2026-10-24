/**
 * ui/SunModeToggle.tsx — Sun mode toggle (R6.1).
 *
 * Sets a data-sun attribute on the root (handled in App) via the store. Colour
 * tokens swap in theme.css; this control is a labelled toggle chip with a sun
 * icon. On narrow phones the text is visually hidden but stays the accessible
 * name, so the chip collapses to an icon button.
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { Icon } from "./Icon";

export function SunModeToggle() {
  const t = useT();
  const sunMode = useStore((s) => s.sunMode);
  const setSunMode = useStore((s) => s.setSunMode);
  return (
    <button
      type="button"
      className={`sun-toggle${sunMode ? " sun-toggle--on" : ""}`}
      aria-pressed={sunMode}
      onClick={() => setSunMode(!sunMode)}
    >
      <span className="sun-toggle__icon">
        <Icon name="sun" size={20} />
      </span>
      <span className="sun-toggle__label">{sunMode ? t("sunMode.on") : t("sunMode.off")}</span>
    </button>
  );
}
