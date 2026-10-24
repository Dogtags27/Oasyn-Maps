/**
 * landing/sections/HowItWorks.tsx — a three-step how-it-works (R11.2).
 */
import { useT } from "@/i18n/useLocale";

export function HowItWorks() {
  const t = useT();
  const steps = ["landing.how.step1", "landing.how.step2", "landing.how.step3"];
  return (
    <section className="howitworks" aria-labelledby="how-title">
      <h2 id="how-title">{t("landing.how.title")}</h2>
      <ol className="howitworks__steps">
        {steps.map((key, i) => (
          <li key={key}>
            <span className="howitworks__num mono">{i + 1}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
