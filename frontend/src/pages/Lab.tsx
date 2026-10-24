import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";

// Fleshed out in Hour 5 (tasks 23-26). Minimal valid page for the shell.
export function Lab() {
  const t = useT();
  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <h1>{t("lab.title")}</h1>
      </main>
    </>
  );
}
