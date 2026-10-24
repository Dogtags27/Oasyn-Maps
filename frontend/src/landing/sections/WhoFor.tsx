/**
 * landing/sections/WhoFor.tsx — "Who it is for" section (R11.2).
 */
import { useT } from "@/i18n/useLocale";

export function WhoFor() {
  const t = useT();
  return (
    <section className="whofor" aria-labelledby="whofor-title">
      <h2 id="whofor-title">{t("landing.whoFor.title")}</h2>
      <p>{t("landing.whoFor.body")}</p>
    </section>
  );
}
