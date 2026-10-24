/**
 * pages/Lab.tsx — the Lab (R7, R17).
 *
 * Three regions: controls, map + playback, metrics. Below a phone breakpoint
 * they collapse into tabs. The map hosts the route and the playback walker and
 * lets you drop/remove SIMULATED caution zones by tapping. The metrics column
 * carries the exposure chart, the embedded watch preview, and the event log.
 * Two extra tabs — Coverage and Leave when — render /api/coverage and
 * /api/departure (Checkpoint 3).
 */
import { useState } from "react";
import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";
import { MapView } from "@/map/MapView";
import { RouteLayer } from "@/map/RouteLayer";
import { OasisLayer } from "@/map/OasisLayer";
import { ParkLayer } from "@/map/ParkLayer";
import { SafetyLayer } from "@/map/SafetyLayer";
import { EndpointsLayer } from "@/map/EndpointsLayer";
import { WalkerLayer } from "@/map/WalkerLayer";
import { LabControls } from "@/lab/LabControls";
import { PlaybackBar } from "@/lab/PlaybackBar";
import { EventLog } from "@/lab/EventLog";
import { CoverageTab } from "@/lab/CoverageTab";
import { DepartureTab } from "@/lab/DepartureTab";
import { Chart } from "@/ui/Chart";
import { WatchCanvas } from "@/watch/WatchCanvas";
import { WearablePanel } from "@/safety/WearablePanel";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { usePlayback } from "@/lab/usePlayback";
import { useStore } from "@/store";

type Tab = "scenario" | "coverage" | "departure";

export function Lab() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("scenario");
  const addZone = useStore((s) => s.addZone);
  const removeZoneAt = useStore((s) => s.removeZoneAt);
  const zones = useStore((s) => s.scenario.zones);

  // Run the playback loop while this page is mounted.
  usePlayback();

  const tabOptions: { value: Tab; label: string }[] = [
    { value: "scenario", label: t("lab.tab.scenario") },
    { value: "coverage", label: t("lab.tab.coverage") },
    { value: "departure", label: t("lab.tab.departure") },
  ];

  return (
    <>
      <TopBar />
      <main id="main" className="lab">
        <h1 className="visually-hidden">{t("lab.title")}</h1>

        <div className="lab__tabs">
          <SegmentedControl
            ariaLabel={t("lab.title")}
            options={tabOptions}
            value={tab}
            onChange={setTab}
          />
        </div>

        {tab === "scenario" && (
          <div className="lab__grid">
            <aside className="lab__controls">
              <h2>{t("lab.controls")}</h2>
              <LabControls />
              <WearablePanel />
            </aside>

            <section className="lab__map-region">
              <div className="lab__map">
                <MapView
                  onMapClick={(ll) => {
                    // Toggle a SIMULATED caution zone at the tapped point.
                    const near = zones.find(
                      (z) =>
                        Math.abs(z.center.lat - ll.lat) < 0.0008 &&
                        Math.abs(z.center.lng - ll.lng) < 0.0008,
                    );
                    if (near) removeZoneAt(near.center);
                    else addZone({ center: ll, q: 0.6, r: 120, simulated: true });
                  }}
                >
                  <ParkLayer />
                  <SafetyLayer />
                  <OasisLayer />
                  <RouteLayer />
                  <EndpointsLayer />
                  <WalkerLayer />
                </MapView>
              </div>
              <PlaybackBar />
            </section>

            <aside className="lab__metrics">
              <h2>{t("lab.metrics")}</h2>
              <Chart />
              <div className="lab__watch-preview">
                <WatchCanvas />
              </div>
              <EventLog />
            </aside>
          </div>
        )}

        {tab === "coverage" && <CoverageTab />}
        {tab === "departure" && <DepartureTab />}
      </main>
    </>
  );
}
