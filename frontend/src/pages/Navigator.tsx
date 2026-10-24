import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";

// Fleshed out in Hour 2-3 (tasks 8-16). Minimal valid page for the shell.
export function Navigator() {
  const t = useT();
  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <h1>{t("nav.map")}</h1>
      </main>
    </>
  );
}
