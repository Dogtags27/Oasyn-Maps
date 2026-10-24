/**
 * a11y/DirectionsList.tsx — screen-reader directions (R13.2, R5.5).
 *
 * The ordered list of the selected route's turns, rendered from backend turn
 * descriptors via t(). It is always present as the map's screen-reader
 * equivalent, so every selected route is operable without the visual map.
 */
import { useLocale } from "@/i18n/useLocale";
import { useSelectedRoute } from "@/store";

export function DirectionsList() {
  const { t, d } = useLocale();
  const route = useSelectedRoute();

  if (!route || route.turns.length === 0) return null;

  return (
    <nav aria-label={t("route.directionsTitle")}>
      <h2>{t("route.directionsTitle")}</h2>
      <ol className="directions">
        {route.turns.map((turn, i) => (
          <li key={i}>{d(turn.descriptor)}</li>
        ))}
      </ol>
    </nav>
  );
}
