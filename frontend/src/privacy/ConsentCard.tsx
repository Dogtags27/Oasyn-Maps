/**
 * privacy/ConsentCard.tsx — first-run consent gate (R14.4).
 *
 * Translated copy describing what stays on device, what the backend sees, the
 * simulated wearable, and the simulated emergency. No analytics or tracking.
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { Dialog } from "@/ui/Dialog";
import { Button } from "@/ui/Button";

export function ConsentCard() {
  const t = useT();
  const consented = useStore((s) => s.consented);
  const setConsented = useStore((s) => s.setConsented);

  return (
    <Dialog
      open={!consented}
      dismissible={false}
      labelledBy="consent-title"
      describedBy="consent-body"
    >
      <h2 id="consent-title">{t("consent.title")}</h2>
      <ul id="consent-body">
        <li>{t("consent.onDevice")}</li>
        <li>{t("consent.backend")}</li>
        <li>{t("consent.wearable")}</li>
        <li>{t("consent.emergency")}</li>
      </ul>
      <Button variant="primary" onClick={() => setConsented(true)}>
        {t("consent.agree")}
      </Button>
    </Dialog>
  );
}
