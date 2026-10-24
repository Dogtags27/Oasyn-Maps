/**
 * landing/sections/Hero.tsx — the hero (R11.1).
 *
 * Gradient headline, subline, two CTAs ("Open the map", "Open the lab"), and an
 * in-house illustration: a phone showing the Navigator (streets, a park, the
 * river, a cool route that draws itself in, a pulsing start dot and a pin that
 * drops at the end) with floating feature chips. Abstract and brand-free; the
 * whole illustration is decorative (aria-hidden), copy comes through t().
 */
import { Link } from "react-router-dom";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { formatDurationSec } from "@/i18n/formatters";
import { Icon } from "@/ui/Icon";

const STREETS_V = [30, 78, 126, 174, 222];
const STREETS_H = [70, 130, 190, 250, 310, 370, 430];

function PhoneMap() {
  return (
    <svg viewBox="0 0 260 520" preserveAspectRatio="xMidYMid slice">
      <rect width="260" height="520" fill="var(--surface-2)" />
      {/* river */}
      <path
        d="M-10 150 C 60 120, 120 190, 190 160 S 280 120, 290 140 L 290 200 C 240 180, 200 230, 140 230 S 40 190, -10 210 Z"
        fill="var(--charles-soft)"
      />
      {/* parks */}
      <rect x="84" y="262" width="88" height="62" rx="14" fill="var(--necklace-soft)" />
      <rect x="182" y="378" width="70" height="80" rx="14" fill="var(--necklace-soft)" />
      <circle cx="40" cy="410" r="26" fill="var(--necklace-soft)" />
      {/* streets */}
      <g stroke="var(--paper)" strokeWidth="9" strokeLinecap="round">
        {STREETS_V.map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="520" />
        ))}
        {STREETS_H.map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="260" y2={y} />
        ))}
      </g>
      <g stroke="var(--line)" strokeWidth="1">
        {STREETS_V.map((x) => (
          <line key={`vl${x}`} x1={x} y1="0" x2={x} y2="520" />
        ))}
      </g>
      {/* trees */}
      <g fill="var(--necklace)" opacity="0.75">
        <circle cx="104" cy="282" r="6" />
        <circle cx="128" cy="300" r="7" />
        <circle cx="152" cy="280" r="5" />
        <circle cx="200" cy="400" r="6" />
        <circle cx="226" cy="430" r="7" />
        <circle cx="34" cy="402" r="6" />
      </g>
      {/* cooling + water markers */}
      <g>
        <circle cx="174" cy="250" r="11" fill="var(--paper)" />
        <circle cx="174" cy="250" r="8" fill="var(--teal)" />
        <circle cx="78" cy="190" r="11" fill="var(--paper)" />
        <circle cx="78" cy="190" r="8" fill="var(--charles)" />
      </g>
      {/* alternative route */}
      <polyline
        points="30,430 30,310 222,310 222,130"
        fill="none"
        stroke="var(--route-alt)"
        strokeWidth="5"
        strokeDasharray="1 9"
        strokeLinecap="round"
      />
      {/* the cool route, drawn in */}
      <polyline
        points="30,430 78,430 78,250 126,250 126,190 174,190 174,130 222,130"
        fill="none"
        stroke="var(--paper)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hero-route"
      />
      <polyline
        points="30,430 78,430 78,250 126,250 126,190 174,190 174,130 222,130"
        fill="none"
        stroke="var(--necklace)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hero-route"
      />
      {/* start dot */}
      <circle className="hero-dot-halo" cx="30" cy="430" r="16" fill="var(--halo-primary)" />
      <circle cx="30" cy="430" r="9" fill="var(--paper)" />
      <circle cx="30" cy="430" r="6" fill="var(--primary)" />
      {/* destination pin */}
      <g className="hero-pin">
        <path
          d="M222 132s-12-11-12-21a12 12 0 0 1 24 0c0 10-12 21-12 21z"
          fill="var(--brick)"
          stroke="var(--paper)"
          strokeWidth="2"
        />
        <circle cx="222" cy="111" r="4.5" fill="var(--paper)" />
      </g>
    </svg>
  );
}

export function Hero() {
  const { t } = useLocale();
  const locale = useStore((s) => s.locale);
  return (
    <section className="hero">
      <div className="hero__text">
        <span className="hero__eyebrow">
          <span className="hero__eyebrow-dot">
            <Icon name="leaf" size={14} />
          </span>
          {t("app.tagline")}
        </span>
        <h1 className="hero__headline">{t("landing.hero.headline")}</h1>
        <p className="hero__subline">{t("landing.hero.subline")}</p>
        <div className="hero__ctas">
          <Link to="/app" className="btn btn--primary">
            <Icon name="map" size={20} />
            {t("landing.hero.openMap")}
          </Link>
          <Link to="/lab" className="btn btn--secondary">
            <Icon name="lab" size={20} />
            {t("landing.hero.openLab")}
          </Link>
        </div>
      </div>
      <div className="hero__art" aria-hidden="true">
        <div className="phone">
          <div className="phone__notch" />
          <div className="phone__screen">
            <PhoneMap />
            <div className="phone__search">
              <span>{t("trip.whereTo")}</span>
              <span>
                <Icon name="search" size={14} />
              </span>
            </div>
            <div className="phone__sheet">
              <div className="phone__row">
                <span className="phone__time">{formatDurationSec(720, locale)}</span>
                <span className="phone__go">
                  <Icon name="walk" size={14} />
                  {t("trip.startWalk")}
                </span>
              </div>
              <div className="phone__strip" />
            </div>
          </div>
        </div>
        <span className="float-chip float-chip--a">
          <span className="float-chip__icon">
            <Icon name="leaf" size={16} />
          </span>
          {t("mode.coolest")}
        </span>
        <span className="float-chip float-chip--b">
          <span className="float-chip__icon">
            <Icon name="drop" size={16} filled />
          </span>
          {t("watch.nearestOasis")}
        </span>
        <span className="float-chip float-chip--c">
          <span className="float-chip__icon">
            <Icon name="sun" size={16} />
          </span>
          {t("sunMode.toggle")}
        </span>
      </div>
    </section>
  );
}
