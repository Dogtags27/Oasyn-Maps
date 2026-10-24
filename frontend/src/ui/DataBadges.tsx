/**
 * ui/DataBadges.tsx — the tappable data-badge stack (R4.7, R2.3).
 *
 * Shows LIVE / SNAPSHOT / SAMPLE DATA for the current mode and reads per-layer
 * provenance from /api/meta; tapping opens the source lines (R4.7). In mock mode
 * the SAMPLE DATA badge is shown (R2.3).
 */
import { useEffect, useState } from "react";
import { useT } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { useClient } from "@/api/useClient";
import type { MetaResponseT } from "@/api/types";
import { Badge } from "./Badge";

export function DataBadges() {
  const t = useT();
  const sampleMode = useStore((s) => s.sampleMode);
  const client = useClient();
  const [meta, setMeta] = useState<MetaResponseT | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    client
      .getMeta()
      .then((m) => active && setMeta(m))
      .catch(() => {
        /* badges still render without provenance */
      });
    return () => {
      active = false;
    };
  }, [client]);

  return (
    <div className="data-badges">
      <button
        type="button"
        className="data-badges__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {sampleMode ? (
          <Badge kind="sample" label={t("badge.sample")} />
        ) : (
          <Badge kind="live" label={t("badge.live")} />
        )}
      </button>
      {open && meta && (
        <ul className="data-badges__sources">
          {meta.layers.map((layer: MetaResponseT["layers"][number]) => (
            <li key={layer.name}>
              <Badge
                kind={layer.kind === "real" ? "snapshot" : "sample"}
                label={layer.name}
              />{" "}
              <span className="data-badges__source-line">
                {layer.name} — {layer.notes ?? layer.url}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
