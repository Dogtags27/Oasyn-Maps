/**
 * pages/Navigator.tsx — the Navigator (R5, R6).
 *
 * Top bar (logo, Sun mode toggle, data-badge stack) + full-screen map + a bottom
 * sheet with peek / half / full content. Desktop promotes the sheet to a 400px
 * left panel via CSS. Start/destination are set by map tap or place search; both
 * set triggers a plan. Routes render ranked; no-path keeps prior state with an
 * inline notice. Every sentence is a descriptor rendered via t().
 */
import { useEffect, useRef } from "react";
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
import { Sheet } from "@/ui/Sheet";
import { SearchBar } from "@/ui/SearchBar";
import { RoutePeek } from "@/ui/RoutePeek";
import { TripControls } from "@/ui/TripControls";
import { RouteCard } from "@/ui/RouteCard";
import { SunModeSuggest } from "@/ui/SunModeSuggest";
import { BackendNotice } from "@/ui/BackendNotice";
import { ResilienceNotice } from "@/ui/ResilienceNotice";
import { OfferCard } from "@/safety/OfferCard";
import { SafetyFlow } from "@/safety/SafetyFlow";
import { useStore } from "@/store";
import { usePlan } from "@/api/usePlan";
import type { OfferT } from "@/api/types";

export function Navigator() {
  const t = useT();
  const setStart = useStore((s) => s.setStart);
  const setGoal = useStore((s) => s.setGoal);
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);
  const routes = useStore((s) => s.routes);
  const selectedId = useStore((s) => s.selectedId);
  const recommendedId = useStore((s) => s.recommendedId);
  const selectRoute = useStore((s) => s.selectRoute);
  const offers = useStore((s) => s.offers);
  const dismissOffer = useStore((s) => s.dismissOffer);
  const plan = usePlan();

  // Route changes only on an explicit Accept (R9.2).
  const acceptOffer = (offer: OfferT) => {
    if (offer.routeId) selectRoute(offer.routeId);
    dismissOffer(offer.snoozeKey);
  };

  // Plan whenever both endpoints are set (map tap or place search).
  const lastKey = useRef<string>("");
  useEffect(() => {
    if (!start || !goal) return;
    const key = `${start.lat},${start.lng}|${goal.lat},${goal.lng}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    void plan();
  }, [start, goal, plan]);

  return (
    <>
      <TopBar />
      <BackendNotice />
      <ResilienceNotice />
      <SunModeSuggest />
      <main id="main" className="navigator">
        <h1 className="visually-hidden">{t("nav.map")}</h1>
        <div className="navigator__map">
          <MapView
            onMapClick={(ll) => {
              if (!start) setStart(ll, t("trip.pinDropped"));
              else if (!goal) setGoal(ll, t("trip.pinDropped"));
              else {
                // Start a new trip: the tap becomes the new start.
                setGoal(null);
                setStart(ll, t("trip.pinDropped"));
              }
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

        <SearchBar />

        <Sheet handleLabel={t("a11y.sheetHandle")} initial="half">
          <RoutePeek />
          {offers.length > 0 && (
            <section className="navigator__offers" aria-live="polite">
              {offers.map((offer) => (
                <OfferCard key={offer.snoozeKey} offer={offer} onAccept={acceptOffer} />
              ))}
            </section>
          )}
          <TripControls />
          <section className="navigator__routes" aria-live="polite">
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                selected={route.id === selectedId}
                recommended={route.id === recommendedId}
                onSelect={selectRoute}
              />
            ))}
          </section>
          <Legend />
          <DirectionsList />
        </Sheet>

        <SafetyFlow body={null} location={start} />
      </main>
    </>
  );
}
