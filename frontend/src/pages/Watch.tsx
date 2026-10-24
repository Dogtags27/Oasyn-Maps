/**
 * pages/Watch.tsx — the Watch route (R8.6).
 *
 * Renders the WatchCanvas. `?bare=1` renders the watch full-screen. The canvas
 * reads the shared store, so it mirrors the active route and Lab playback.
 */
import { useSearchParams } from "react-router-dom";
import { useT } from "@/i18n/useLocale";
import { WatchCanvas } from "@/watch/WatchCanvas";

export function Watch() {
  const t = useT();
  const [params] = useSearchParams();
  const bare = params.get("bare") === "1";

  if (bare) {
    return (
      <main id="main">
        <h1 className="visually-hidden">{t("nav.watch")}</h1>
        <WatchCanvas bare />
      </main>
    );
  }

  return (
    <main id="main" className="page watch-page">
      <h1>{t("nav.watch")}</h1>
      <WatchCanvas />
    </main>
  );
}
