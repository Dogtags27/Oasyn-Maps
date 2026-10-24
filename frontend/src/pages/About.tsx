import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";

export function About() {
  const t = useT();
  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <h1>{t("about.title")}</h1>
        <p>{t("about.body")}</p>
      </main>
    </>
  );
}
