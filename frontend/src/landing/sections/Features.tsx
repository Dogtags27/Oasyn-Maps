/**
 * landing/sections/Features.tsx — six numbered feature rows (R11.2).
 *
 * Alternating text/media rows, numbered. Titles and bodies are i18n keys; media
 * comes from the registry (hatched placeholders until assets land).
 */
import { useT } from "@/i18n/useLocale";
import { featureMedia } from "../media";
import { MediaFigure } from "../MediaFigure";

export function Features() {
  const t = useT();
  const rows = [1, 2, 3, 4, 5, 6];

  return (
    <section className="features" aria-labelledby="features-title">
      <h2 id="features-title">{t("landing.features.title")}</h2>
      <ol className="features__list">
        {rows.map((n, i) => (
          <li key={n} className={`features__row${i % 2 === 1 ? " features__row--reverse" : ""}`}>
            <div className="features__text">
              <span className="features__num mono">{String(n).padStart(2, "0")}</span>
              <h3>{t(`landing.feature.${n}.title`)}</h3>
              <p>{t(`landing.feature.${n}.body`)}</p>
            </div>
            <MediaFigure slot={featureMedia[i]} />
          </li>
        ))}
      </ol>
    </section>
  );
}
