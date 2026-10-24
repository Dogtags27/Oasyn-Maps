/**
 * landing/sections/BuiltWithKiro.tsx — the "Built with Kiro" section (R18.1).
 *
 * References the spec, steering, hooks, and CLI that governed the build. Copy
 * comes through t(); the list items are translated labels.
 */
import { useT } from "@/i18n/useLocale";

export function BuiltWithKiro() {
  const t = useT();
  return (
    <section className="built-with-kiro" aria-labelledby="kiro-title">
      <h2 id="kiro-title">{t("landing.kiro.title")}</h2>
      <p>{t("landing.kiro.body")}</p>
      <ul className="built-with-kiro__list">
        <li>{t("landing.kiro.spec")}</li>
        <li>{t("landing.kiro.steering")}</li>
        <li>{t("landing.kiro.hooks")}</li>
        <li>{t("landing.kiro.cli")}</li>
      </ul>
    </section>
  );
}
