/**
 * pages/Watch.tsx — the Watch route (R8.6).
 *
 * Renders the WatchCanvas with the shared TopBar (brand + nav back to Map/Lab,
 * R5.1) so /watch isn't a dead end. `?bare=1` renders the watch full-screen with
 * no chrome at all — that mode is for embedding the device mock on its own
 * (e.g. in an iframe), so it intentionally has no nav. The canvas reads the
 * shared store, so it mirrors the active route and Lab playback.
 */
import { useSearchParams } from "react-router-dom";
import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";
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
    <>
      <TopBar />
      <main id="main" className="page watch-page">
        <h1>{t("nav.watch")}</h1>
        <WatchCanvas />
      </main>
    </>
  );
}
