/**
 * App.tsx — mirrors prefs (sun mode, reduced motion, contrast) onto the document
 * root and composes the providers + consent gate + backend notice.
 *
 * `data-sun` on the root drives the Sun-mode token swap (R6.2). The media-query
 * mirrors keep prefers-reduced-motion / prefers-contrast in the store (R13.5).
 */
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/store";
import { ConsentCard } from "@/privacy/ConsentCard";
import { BackendNotice } from "@/ui/BackendNotice";
import { useT } from "@/i18n/useLocale";

export function App({ children }: { children: ReactNode }) {
  const t = useT();
  const sunMode = useStore((s) => s.sunMode);
  const setReducedMotion = useStore((s) => s.setReducedMotion);
  const setHighContrast = useStore((s) => s.setHighContrast);

  useEffect(() => {
    document.documentElement.setAttribute("data-sun", sunMode ? "on" : "off");
  }, [sunMode]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrast = window.matchMedia("(prefers-contrast: more)");
    const onMotion = () => setReducedMotion(motion.matches);
    const onContrast = () => setHighContrast(contrast.matches);
    onMotion();
    onContrast();
    motion.addEventListener?.("change", onMotion);
    contrast.addEventListener?.("change", onContrast);
    return () => {
      motion.removeEventListener?.("change", onMotion);
      contrast.removeEventListener?.("change", onContrast);
    };
  }, [setReducedMotion, setHighContrast]);

  return (
    <>
      <a className="skip-link" href="#main">
        {t("a11y.skipToContent")}
      </a>
      <BackendNotice />
      {children}
      <ConsentCard />
    </>
  );
}
