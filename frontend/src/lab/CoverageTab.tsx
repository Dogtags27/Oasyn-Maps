/**
 * lab/CoverageTab.tsx — the Lab Coverage tab (R17.2) [T2] (Checkpoint 3).
 *
 * Walking minutes to the nearest oasis, the share of streets within 5 and 10
 * minutes, and suggested top-k sites labelled as a heuristic — all from
 * /api/coverage. The 5/10-minute windows and suggestK come from config. The
 * heuristic note is a backend descriptor, keeping the honesty labelling.
 */
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { useClient } from "@/api/useClient";
import { viewConfig } from "@/config";
import { formatPercent, formatMinutes } from "@/i18n/formatters";
import type { CoverageResponseT } from "@/api/types";

export function CoverageTab() {
  const { t, d } = useLocale();
  const client = useClient();
  const locale = useStore((s) => s.locale);
  const scenario = useStore((s) => s.scenario);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const [data, setData] = useState<CoverageResponseT | null>(null);

  useEffect(() => {
    let active = true;
    client
      .coverage({ scenario, suggestK: cfg.suggestK })
      .then((d2) => active && setData(d2))
      .catch(() => {
        /* resilience notices cover hard failures */
      });
    return () => {
      active = false;
    };
  }, [client, scenario, cfg.suggestK]);

  if (!data) return <div className="lab-tab">{t("coverage.title")}</div>;

  return (
    <section className="lab-tab coverage-tab" aria-label={t("coverage.title")}>
      <h3>{t("coverage.title")}</h3>
      <dl className="coverage-tab__stats">
        <div>
          <dt>{t("coverage.within5")}</dt>
          <dd className="mono">{formatPercent(data.within5Pct, locale)}</dd>
        </div>
        <div>
          <dt>{t("coverage.within10")}</dt>
          <dd className="mono">{formatPercent(data.within10Pct, locale)}</dd>
        </div>
      </dl>
      <ol className="coverage-tab__suggestions">
        {data.suggestions.map((s, i) => (
          <li key={i}>
            {d(s.label)} — {formatMinutes(s.benefit, locale)}
          </li>
        ))}
      </ol>
      <p className="coverage-tab__note">{d(data.heuristicNote)}</p>
    </section>
  );
}
