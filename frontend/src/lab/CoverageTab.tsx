/**
 * lab/CoverageTab.tsx — "Cooling access": equity coverage of cooling spots (R17.2).
 *
 * Renders /api/coverage in plain language:
 *   - an intro that says what the tab answers;
 *   - two ring gauges: the share of the area within a 5- and 10-minute walk of
 *     a cooling spot (backend numbers, formatted via Intl);
 *   - a map of sampled walking times (coloured by 5 / 10 minute bands, always
 *     with a text legend) plus the existing cooling spots and the suggested
 *     new sites;
 *   - the ranked suggestions with how much walking each would save;
 *   - a short "how to read this" and the backend's heuristic note.
 * Every sentence comes through t() or is a backend descriptor.
 */
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { useClient } from "@/api/useClient";
import { viewConfig } from "@/config";
import { formatPercent, formatMinutes } from "@/i18n/formatters";
import type { CoverageResponseT } from "@/api/types";
import { MapView } from "@/map/MapView";
import { OasisLayer } from "@/map/OasisLayer";
import { ParkLayer } from "@/map/ParkLayer";
import { Icon } from "@/ui/Icon";
import { CoverageLayer } from "./CoverageLayer";

/** Large totals read better in hours ("about 596 hours") than in minutes. */
function formatSaved(minutes: number, locale: string): string {
  if (minutes < 120) return formatMinutes(Math.round(minutes), locale);
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "hour",
      unitDisplay: "long",
      maximumFractionDigits: 0,
    }).format(minutes / 60);
  } catch {
    return formatMinutes(Math.round(minutes), locale);
  }
}

function RingStat({ pct, tone, caption }: { pct: number; tone: "cool" | "primary"; caption: string }) {
  const locale = useStore((s) => s.locale);
  const R = 34;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, pct / 100));
  return (
    <div className={`ring-stat ring-stat--${tone}`}>
      <div className="ring-stat__dial">
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
          <circle cx="42" cy="42" r={R} fill="none" className="ring-stat__track" strokeWidth="9" />
          <circle
            cx="42"
            cy="42"
            r={R}
            fill="none"
            className="ring-stat__bar"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${C * frac} ${C}`}
            transform="rotate(-90 42 42)"
          />
        </svg>
        <span className="ring-stat__value mono">{formatPercent(pct, locale)}</span>
      </div>
      <p className="ring-stat__caption">{caption}</p>
    </div>
  );
}

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

  const maxBenefit = data ? Math.max(1, ...data.suggestions.map((s) => s.benefit)) : 1;

  return (
    <section className="lab-tab coverage-tab" aria-label={t("coverage.title")}>
      <header className="tab-hero tab-hero--cool">
        <span className="tab-hero__icon">
          <Icon name="drop" size={26} filled />
        </span>
        <div>
          <h3 className="tab-hero__title">{t("coverage.title")}</h3>
          <p className="tab-hero__body">{t("coverage.intro.body")}</p>
        </div>
      </header>

      {!data ? (
        <div className="tab-card tab-card--loading" role="status">
          <span className="tab-skeleton" />
          <span className="tab-skeleton tab-skeleton--short" />
          <span className="visually-hidden">{t("common.loading")}</span>
        </div>
      ) : (
        <div className="tab-cols">
          <div className="tab-col">
          <div className="tab-card tab-card--stats">
            <RingStat pct={data.within5Pct} tone="cool" caption={t("coverage.stat.within5")} />
            <RingStat pct={data.within10Pct} tone="primary" caption={t("coverage.stat.within10")} />
          </div>

          <div className="tab-card tab-card--sugg">
            <h4 className="tab-card__title">
              <Icon name="spark" size={18} />
              {t("coverage.suggestions.title")}
            </h4>
            <p className="tab-card__lead">{t("coverage.suggestions.body")}</p>
            {data.suggestions.length === 0 ? (
              <p className="tab-card__empty">{t("coverage.none")}</p>
            ) : (
              <ol className="coverage-tab__suggestions">
                {data.suggestions.map((s, i) => (
                  <li key={i} className="suggestion">
                    <span className="suggestion__rank mono">{i + 1}</span>
                    <div className="suggestion__body">
                      <span className="suggestion__label">{d(s.label)}</span>
                      <span className="suggestion__bar" aria-hidden="true">
                        <span style={{ width: `${(s.benefit / maxBenefit) * 100}%` }} />
                      </span>
                      <span className="suggestion__saves">
                        {t("coverage.saves", { minutes: formatSaved(s.benefit, locale) })}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          </div>
          <div className="tab-col">
          <div className="tab-card tab-card--map">
            <h4 className="tab-card__title">
              <Icon name="map" size={18} />
              {t("coverage.map.title")}
            </h4>
            <div className="coverage-map">
              <MapView>
                <ParkLayer />
                <OasisLayer />
                <CoverageLayer samples={data.samples} suggestions={data.suggestions} />
              </MapView>
            </div>
            <ul className="map-legend">
              <li>
                <span className="map-legend__dot map-legend__dot--near" aria-hidden="true" />
                {t("coverage.legend.near")}
              </li>
              <li>
                <span className="map-legend__dot map-legend__dot--mid" aria-hidden="true" />
                {t("coverage.legend.mid")}
              </li>
              <li>
                <span className="map-legend__dot map-legend__dot--far" aria-hidden="true" />
                {t("coverage.legend.far")}
              </li>
              <li>
                <span className="map-legend__dot map-legend__dot--existing" aria-hidden="true" />
                {t("coverage.legend.existing")}
              </li>
              <li>
                <span className="map-legend__dot map-legend__dot--suggested" aria-hidden="true" />
                {t("coverage.legend.suggested")}
              </li>
            </ul>
          </div>

          <div className="tab-card tab-card--how">
            <h4 className="tab-card__title">
              <Icon name="info" size={18} />
              {t("coverage.how.title")}
            </h4>
            <ol className="how-steps">
              <li>
                <span className="how-steps__icon how-steps__icon--a">
                  <Icon name="walk" size={18} />
                </span>
                {t("coverage.how.step1")}
              </li>
              <li>
                <span className="how-steps__icon how-steps__icon--b">
                  <Icon name="check" size={18} />
                </span>
                {t("coverage.how.step2")}
              </li>
              <li>
                <span className="how-steps__icon how-steps__icon--c">
                  <Icon name="pin" size={18} />
                </span>
                {t("coverage.how.step3")}
              </li>
            </ol>
            <p className="coverage-tab__note">
              <Icon name="info" size={16} />
              {d(data.heuristicNote)}
            </p>
          </div>
          </div>
        </div>
      )}
    </section>
  );
}
