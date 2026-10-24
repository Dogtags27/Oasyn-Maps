/**
 * lab/DepartureTab.tsx — the Lab "Leave when" tab (R17.1) [T2] (Checkpoint 3).
 *
 * Best-route modeled heat vs departure time across the day plus the best window,
 * from /api/departure. A hand-rolled SVG curve with the best point marked. Times
 * are Intl-formatted; the reduction and best window come from the response.
 */
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { useClient } from "@/api/useClient";
import { formatTime, formatPercent } from "@/i18n/formatters";
import type { DepartureResponseT } from "@/api/types";

const W = 320;
const H = 160;
const PAD = 28;

export function DepartureTab() {
  const { t } = useLocale();
  const client = useClient();
  const locale = useStore((s) => s.locale);
  const scenario = useStore((s) => s.scenario);
  const start = useStore((s) => s.start);
  const goal = useStore((s) => s.goal);
  const mode = useStore((s) => s.mode);
  const [data, setData] = useState<DepartureResponseT | null>(null);

  useEffect(() => {
    if (!start || !goal) return;
    let active = true;
    client
      .departure({ from: start, to: goal, mode, scenario })
      .then((d2) => active && setData(d2))
      .catch(() => {
        /* resilience notices cover hard failures */
      });
    return () => {
      active = false;
    };
  }, [client, start, goal, mode, scenario]);

  if (!start || !goal) {
    return <div className="lab-tab">{t("departure.title")}</div>;
  }
  if (!data || data.points.length === 0) {
    return <div className="lab-tab">{t("departure.title")}</div>;
  }

  const times = data.points.map((p) => new Date(p.tISO).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const maxHeat = Math.max(1, ...data.points.map((p) => p.heatMin));
  const x = (ts: number) => PAD + ((ts - minT) / Math.max(1, maxT - minT)) * (W - 2 * PAD);
  const y = (h: number) => H - PAD - (h / maxHeat) * (H - 2 * PAD);
  const line = data.points
    .map((p) => `${x(new Date(p.tISO).getTime())},${y(p.heatMin)}`)
    .join(" ");
  const bestX = x(new Date(data.best.tISO).getTime());

  return (
    <section className="lab-tab departure-tab" aria-label={t("departure.title")}>
      <h3>{t("departure.title")}</h3>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("departure.title")}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--ink)" strokeWidth="1.5" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--ink)" strokeWidth="1.5" />
        <polyline points={line} fill="none" stroke="var(--ink)" strokeWidth="2" />
        <line x1={bestX} y1={PAD} x2={bestX} y2={H - PAD} stroke="var(--necklace)" strokeWidth="2" />
      </svg>
      <p className="departure-tab__best">
        {t("departure.best", {
          time: formatTime(data.best.tISO, locale),
          reduction: formatPercent(data.best.reductionPct, locale),
        })}
      </p>
    </section>
  );
}
