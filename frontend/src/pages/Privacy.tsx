/**
 * pages/Privacy.tsx — the Privacy page (R14.3).
 *
 * Lists what is stored on device and what is sent off it, shows the on-device
 * id, and offers reset-and-delete and JSON export. No analytics or tracking.
 */
import { useState } from "react";
import { useT } from "@/i18n/useLocale";
import { TopBar } from "@/ui/TopBar";
import { Button } from "@/ui/Button";
import { useStore } from "@/store";
import { resetUid, clearLocalData, exportLocalData } from "@/privacy/uid";

export function Privacy() {
  const t = useT();
  const uid = useStore((s) => s.uid);
  const setUid = useStore((s) => s.setUid);
  const [done, setDone] = useState(false);

  function onReset() {
    clearLocalData();
    const fresh = resetUid();
    setUid(fresh);
    setDone(true);
  }

  function onExport() {
    const blob = new Blob([exportLocalData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oasyn-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <h1>{t("privacy.title")}</h1>

        <section>
          <h2>{t("privacy.yourId")}</h2>
          <p className="mono">{uid}</p>
        </section>

        <section>
          <h2>{t("privacy.stored.title")}</h2>
          <ul>
            <li>{t("privacy.stored.id")}</li>
            <li>{t("privacy.stored.prefs")}</li>
          </ul>
        </section>

        <section>
          <h2>{t("privacy.sent.title")}</h2>
          <ul>
            <li>{t("privacy.sent.routing")}</li>
            <li>{t("privacy.sent.tiles")}</li>
            <li>{t("privacy.sent.weather")}</li>
          </ul>
        </section>

        <div className="privacy-actions">
          <Button variant="secondary" onClick={onReset}>
            {t("privacy.reset")}
          </Button>
          <Button variant="secondary" onClick={onExport}>
            {t("privacy.export")}
          </Button>
        </div>
        {done && <p role="status">{t("privacy.resetDone")}</p>}
      </main>
    </>
  );
}
