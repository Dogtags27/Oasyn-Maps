/**
 * ui/LanguageSwitcher.tsx — header language switcher (R12.5).
 *
 * Native names, bound to the store's locale (which is detected from
 * navigator.language, persisted locally, and drives <html lang>). Styled as a
 * globe chip wrapping a native <select> so phones get the OS picker.
 */
import { useT } from "@/i18n/useLocale";
import { locales, localeCodes } from "@/i18n/locales";
import { useStore } from "@/store";
import { Icon } from "./Icon";

export function LanguageSwitcher() {
  const t = useT();
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  return (
    <label className="lang-switcher">
      <span className="visually-hidden">{t("a11y.languageSwitcher")}</span>
      <span className="lang-switcher__icon">
        <Icon name="globe" size={18} />
      </span>
      <select
        aria-label={t("a11y.languageSwitcher")}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
      >
        {localeCodes.map((code) => (
          <option key={code} value={code}>
            {locales[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
