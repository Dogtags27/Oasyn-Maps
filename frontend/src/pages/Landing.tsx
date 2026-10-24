/**
 * pages/Landing.tsx — the landing page (R11).
 *
 * Composes the hero, six feature rows, how-it-works, data-and-honesty, who-it-is-
 * for, built-with-kiro, the language switcher, and a footer with links to
 * Privacy and About. One h1 (in the hero); sections use ordered h2s.
 */
import { Link } from "react-router-dom";
import { useT } from "@/i18n/useLocale";
import { LanguageSwitcher } from "@/ui/LanguageSwitcher";
import { BrandMark } from "@/ui/BrandMark";
import { Hero } from "@/landing/sections/Hero";
import { Features } from "@/landing/sections/Features";
import { HowItWorks } from "@/landing/sections/HowItWorks";
import { DataHonesty } from "@/landing/sections/DataHonesty";
import { WhoFor } from "@/landing/sections/WhoFor";
import { BuiltWithKiro } from "@/landing/sections/BuiltWithKiro";

export function Landing() {
  const t = useT();
  return (
    <>
      <header className="landing-top">
        <Link to="/" className="landing-top__brand topbar__brand">
          <BrandMark size={32} />
          <span className="landing-top__brand-text">{t("app.name")}</span>
        </Link>
        <nav className="landing-top__nav" aria-label={t("app.name")}>
          <Link to="/app">{t("nav.map")}</Link>
          <Link to="/lab">{t("nav.lab")}</Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <main id="main" className="landing">
        <Hero />
        <Features />
        <HowItWorks />
        <DataHonesty />
        <WhoFor />
        <BuiltWithKiro />
      </main>

      <footer className="landing-footer">
        <Link to="/privacy">{t("landing.footer.privacy")}</Link>
        <Link to="/about">{t("landing.footer.about")}</Link>
      </footer>
    </>
  );
}
