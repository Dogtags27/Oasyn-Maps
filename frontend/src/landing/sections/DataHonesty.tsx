/**
 * landing/sections/DataHonesty.tsx — data-and-honesty section (R11.2, R15.3).
 *
 * The badge legend (LIVE / SNAPSHOT / ESTIMATED / SIMULATED / SAMPLE DATA) plus
 * the honesty statement that exposure is modeled and safety/wearable features
 * are simulated. Badge labels come through t().
 */
import { useT } from "@/i18n/useLocale";
import { Badge } from "@/ui/Badge";

export function DataHonesty() {
  const t = useT();
  return (
    <section className="data-honesty" aria-labelledby="honesty-title">
      <h2 id="honesty-title">{t("landing.honesty.title")}</h2>
      <p>{t("landing.honesty.body")}</p>
      <ul className="data-honesty__legend">
        <li>
          <Badge kind="live" label={t("badge.live")} />
        </li>
        <li>
          <Badge kind="snapshot" label={t("badge.snapshot")} />
        </li>
        <li>
          <Badge kind="estimated" label={t("badge.estimated")} />
        </li>
        <li>
          <Badge kind="simulated" label={t("badge.simulated")} />
        </li>
        <li>
          <Badge kind="sample" label={t("badge.sample")} />
        </li>
      </ul>
    </section>
  );
}
