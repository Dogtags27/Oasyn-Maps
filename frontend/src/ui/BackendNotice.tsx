/**
 * ui/BackendNotice.tsx — unreachable-backend notice + badged sample offer (R2.7).
 *
 * Shown only when a live request has flagged the backend unreachable. It never
 * swaps to sample mode silently; the user accepts the clearly badged sample mode.
 */
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { useClient } from "@/api/useClient";
import { Button } from "./Button";
import { Badge } from "./Badge";

export function BackendNotice() {
  const t = useT();
  const unreachable = useStore((s) => s.unreachable);
  const sampleMode = useStore((s) => s.sampleMode);
  const client = useClient();

  if (!unreachable || sampleMode) return null;

  return (
    <div className="backend-notice" role="status">
      <span>{t("notice.backendUnreachable")}</span>
      <Button
        variant="secondary"
        onClick={() => client.setMode("mock")}
      >
        <Badge kind="sample" label={t("badge.sample")} /> {t("action.useSampleData")}
      </Button>
    </div>
  );
}
