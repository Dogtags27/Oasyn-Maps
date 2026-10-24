import { useT } from "@/i18n/useLocale";

// Fleshed out in Hour 4 (task 21). Minimal valid page for the shell.
export function Watch() {
  const t = useT();
  return (
    <main id="main" className="page">
      <h1>{t("nav.watch")}</h1>
    </main>
  );
}
