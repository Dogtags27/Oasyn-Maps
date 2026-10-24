/**
 * a11y/DirectionsList.tsx — screen-reader directions (R13.2, R5.5).
 *
 * The ordered list of the selected route's turns, rendered from backend turn
 * descriptors via t(). It is always present as the map's screen-reader
 * equivalent, so every selected route is operable without the visual map.
 * Visually it is a coloured timeline; the step numbers are decorative
 * (aria-hidden) since the <ol> already conveys order.
 */
import { useLocale } from "@/i18n/useLocale";
import { useSelectedRoute } from "@/store";

export function DirectionsList() {
  const { t, d } = useLocale();
  const route = useSelectedRoute();
  if (!route || route.turns.length === 0) return null;
  const last = route.turns.length - 1;
  return (
    <nav className="directions-card" aria-label={t("route.directionsTitle")}>
      <h2>{t("route.directionsTitle")}</h2>
      <ol className="directions">
        {route.turns.map((turn, i) => (
          <li
            key={i}
            className={`directions__step${i === 0 ? " directions__step--first" : ""}${
              i === last ? " directions__step--last" : ""
            }`}
          >
            <span className="directions__num mono" aria-hidden="true">
              {i + 1}
            </span>
            <span className="directions__text">{d(turn.descriptor)}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
