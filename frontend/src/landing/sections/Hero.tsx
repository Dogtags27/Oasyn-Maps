/**
 * landing/sections/Hero.tsx — the hero (R11.1).
 *
 * Fraunces headline, subline, two CTAs ("Open the map", "Open the lab"), and an
 * in-house SVG street-grid illustration (abstract, ink-outlined, brand-free).
 */
import { Link } from "react-router-dom";
import { useT } from "@/i18n/useLocale";
import { Button } from "@/ui/Button";

export function Hero() {
  const t = useT();
  return (
    <section className="hero">
      <div className="hero__text">
        <h1 className="hero__headline">{t("landing.hero.headline")}</h1>
        <p className="hero__subline">{t("landing.hero.subline")}</p>
        <div className="hero__ctas">
          <Link to="/app">
            <Button variant="primary">{t("landing.hero.openMap")}</Button>
          </Link>
          <Link to="/lab">
            <Button variant="secondary">{t("landing.hero.openLab")}</Button>
          </Link>
        </div>
      </div>
      <div className="hero__art" aria-hidden="true">
        <svg viewBox="0 0 200 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <g stroke="var(--ink-2)" strokeWidth="1" opacity="0.5">
            {[20, 50, 80, 110, 140, 170].map((x) => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="160" />
            ))}
            {[20, 50, 80, 110, 140].map((y) => (
              <line key={`h${y}`} x1="0" y1={y} x2="200" y2={y} />
            ))}
          </g>
          {/* a highlighted cool route across the grid */}
          <polyline
            points="20,140 50,110 80,110 110,80 140,50 170,20"
            fill="none"
            stroke="var(--necklace)"
            strokeWidth="3"
          />
          <circle cx="20" cy="140" r="4" fill="var(--ink)" />
          <path d="M170 20 l8 4 l-8 4 z" fill="var(--ink)" />
        </svg>
      </div>
    </section>
  );
}
