/**
 * safety/CautionBanner.tsx — the heat caution banner (R9.3).
 *
 * Amber band with an ink border and a leaf-in-triangle glyph; redundant text +
 * pattern so colour is never the sole signal. Dismissible. Includes the honest
 * disclaimer "Prototype. Not a medical device." Shown when escalation is in the
 * caution phase.
 */
import { useState } from "react";
import { useT } from "@/i18n/useLocale";
import { Button } from "@/ui/Button";
import { cautionGlyph } from "./glyphs";

export function CautionBanner() {
  const t = useT();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="caution-banner" role="status">
      <span
        className="caution-banner__glyph"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: cautionGlyph() }}
      />
      <div className="caution-banner__text">
        <strong>{t("safety.caution.title")}</strong>
        <span>{t("safety.caution.disclaimer")}</span>
      </div>
      <Button variant="secondary" onClick={() => setDismissed(true)}>
        {t("action.dismiss")}
      </Button>
    </div>
  );
}
