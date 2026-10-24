import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";

// Fleshed out in Hour 6 (tasks 27-28). Minimal valid page for the shell.
export function Landing() {
  const t = useT();
  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <h1>{t("landing.hero.headline")}</h1>
        <p>{t("landing.hero.subline")}</p>
      </main>
    </>
  );
}
