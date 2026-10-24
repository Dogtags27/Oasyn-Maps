/**
 * ui/TopBar.tsx — the shared top bar: brand, nav, Sun mode toggle, data badges,
 * and the language switcher (R5.1).
 *
 * Phone: a slim glass header plus the nav docked as a bottom tab bar in the
 * thumb zone (like a native maps app). Desktop: the nav sits inline as pills.
 * It is one <nav> either way; only CSS moves it.
 */
import { Link, NavLink } from "react-router-dom";
import { useT } from "@/i18n/useLocale";
import { SunModeToggle } from "./SunModeToggle";
import { DataBadges } from "./DataBadges";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Icon, type IconName } from "./Icon";
import { BrandMark } from "./BrandMark";

const TABS: { to: string; key: string; icon: IconName; tone: string }[] = [
  { to: "/app", key: "nav.map", icon: "map", tone: "blue" },
  { to: "/lab", key: "nav.lab", icon: "lab", tone: "violet" },
  { to: "/watch", key: "nav.watch", icon: "watch", tone: "teal" },
];

export function TopBar() {
  const t = useT();
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">
        <BrandMark size={32} />
        <span className="topbar__brand-text">{t("app.name")}</span>
      </Link>
      <nav className="topnav" aria-label={t("nav.landing")}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={`topnav__link topnav__link--${tab.tone}`}>
            <span className="topnav__icon">
              <Icon name={tab.icon} size={22} />
            </span>
            <span className="topnav__label">{t(tab.key)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="topbar__actions">
        <DataBadges />
        <SunModeToggle />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
