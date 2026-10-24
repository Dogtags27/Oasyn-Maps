/**
 * ui/TopBar.tsx — the shared top bar: brand, nav, Sun mode toggle, data badges,
 * and the language switcher (R5.1).
 */
import { Link, NavLink } from "react-router-dom";
import { useT } from "@/i18n/useLocale";
import { SunModeToggle } from "./SunModeToggle";
import { DataBadges } from "./DataBadges";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar() {
  const t = useT();
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">
        {t("app.name")}
      </Link>
      <nav className="topnav" aria-label={t("nav.landing")}>
        <NavLink to="/app">{t("nav.map")}</NavLink>
        <NavLink to="/lab">{t("nav.lab")}</NavLink>
        <NavLink to="/watch">{t("nav.watch")}</NavLink>
      </nav>
      <div className="topbar__actions">
        <DataBadges />
        <SunModeToggle />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
