/**
 * watch/WatchCanvas.tsx — the 198x242pt watch canvas inside a drawn bezel (R8.1).
 *
 * Black background with brightened tokens (via tokens/watch.css, scoped by the
 * data-watch attribute). Hosts the Pager of views (Next move / Exposure ring /
 * Nearest oasis / Body) and surfaces the AlertOverlay when an offer is active.
 * All views read the shared store, so Lab playback and the standalone /watch
 * stay in sync (R8.4).
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { Pager } from "./Pager";
import { NextMove } from "./views/NextMove";
import { ExposureRing } from "./views/ExposureRing";
import { NearestOasis } from "./views/NearestOasis";
import { Body } from "./views/Body";
import { AlertOverlay } from "./AlertOverlay";
import "@/tokens/watch.css";

export interface WatchCanvasProps {
  /** Render full-screen (the ?bare=1 mode) instead of inside a bezel. */
  bare?: boolean;
}

export function WatchCanvas({ bare = false }: WatchCanvasProps) {
  const t = useT();
  const offers = useStore((s) => s.offers);
  const dismissOffer = useStore((s) => s.dismissOffer);
  const selectRoute = useStore((s) => s.selectRoute);

  // Surface the highest-priority active offer as the watch alert.
  const alertOffer = offers.find((o) => o.priority === "high") ?? offers[0] ?? null;

  const views = [
    { id: "next", label: t("watch.nextMove"), node: <NextMove /> },
    { id: "ring", label: t("watch.exposureRing"), node: <ExposureRing /> },
    { id: "oasis", label: t("watch.nearestOasis"), node: <NearestOasis /> },
    { id: "body", label: t("watch.body"), node: <Body /> },
  ];

  const inner = (
    <div className="watch-canvas" data-watch>
      {alertOffer ? (
        <AlertOverlay
          offer={alertOffer}
          onSwitch={() => {
            if (alertOffer.routeId) selectRoute(alertOffer.routeId);
            dismissOffer(alertOffer.snoozeKey);
          }}
          onKeep={() => dismissOffer(alertOffer.snoozeKey)}
        />
      ) : (
        <Pager views={views} ariaLabel={t("nav.watch")} />
      )}
    </div>
  );

  if (bare) return <div className="watch-bare">{inner}</div>;

  return (
    <div className="watch-bezel" aria-label={t("nav.watch")}>
      {inner}
    </div>
  );
}
