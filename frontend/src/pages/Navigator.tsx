/**
 * pages/Navigator.tsx — the map experience (R5).
 *
 * Hour 2 wires the full map stack: MapView with CARTO tiles, the route and
 * resource/feature layers, the sun badge, the legend, place search, and the
 * screen-reader directions list. The bottom-sheet trip flow and plan wiring land
 * in Hour 3 (tasks 14-16); this page already composes the pieces so they render.
 */
import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";
import { MapView } from "@/map/MapView";
import { RouteLayer } from "@/map/RouteLayer";
import { OasisLayer } from "@/map/OasisLayer";
import { TreeLayer } from "@/map/TreeLayer";
import { ParkLayer } from "@/map/ParkLayer";
import { SafetyLayer } from "@/map/SafetyLayer";
import { EndpointsLayer } from "@/map/EndpointsLayer";
import { SunBadge } from "@/map/SunBadge";
import { Legend } from "@/ui/Legend";
import { DirectionsList } from "@/a11y/DirectionsList";
import { useStore } from "@/store";

export function Navigator() {
  const t = useT();
  const setStart = useStore((s) => s.setStart);
  const setGoal = useStore((s) => s.setGoal);
  const start = useStore((s) => s.start);

  return (
    <>
      <TopBar />
      <main id="main" className="navigator">
        <h1 className="visually-hidden">{t("nav.map")}</h1>
        <div className="navigator__map">
          <MapView
            onMapClick={(ll) => {
              // First tap sets start, second sets destination (temporary until
              // the Hour 3 sheet provides explicit start/destination fields).
              if (!start) setStart(ll);
              else setGoal(ll);
            }}
          >
            <ParkLayer />
            <SafetyLayer />
            <TreeLayer />
            <OasisLayer />
            <RouteLayer />
            <EndpointsLayer />
          </MapView>
          <SunBadge />
        </div>
        <div className="navigator__panel">
          <Legend />
          <DirectionsList />
        </div>
      </main>
    </>
  );
}
