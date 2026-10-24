/**
 * lab/DepartureTab.tsx — "Best time to go": the across-day departure planner (R17.2).
 *
 * Renders /api/departure in plain language for the current start/destination:
 *   - an intro that says what the tab answers;
 *   - a hero card with the recommended start time and how much less heat it
 *     has than the hottest time sampled (backend numbers, formatted via Intl);
 *   - a chart of heat-minutes across the day with labelled axes, the coolest
 *     and hottest times marked, over a decorative sun arc;
 *   - every sampled start time as a row with a heat bar;
 *   - a one-line definition of heat-minutes.
 * With no trip yet it explains what to do and offers a sample trip.
 */
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { useClient } from "@/api/useClient";
import { usePresets } from "@/api/usePresets";
import { usePlan } from "@/api/usePlan";
import { formatTime, formatPercent, formatMinutes } from "@/i18n/formatters";
import type { DepartureResponseT } from "@/api/types";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";

const W = 340;
const H = 190;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 26;
const PAD_B = 34;

type Tone = "low" | "elevated" | "high";

/** Below this spread (as a share of the peak) the day is effectively flat. */
const FLAT_SPREAD = 0.15;

/**
 * Tone relative to the day's range, so the bars read at a glance. When every
 * start time is about the same, nothing is flagged hot: colouring a 0.1-minute
 * difference red would overstate it.
 */
function toneFor(heat: number, min: number, max: number): Tone {
  if (max <= 0 || (max - min) / max < FLAT_SPREAD) return "low";
  const span = Math.max(0.0001, max - min);
  const f = (heat - min) / span;
  if (f < 0.34) return "low";
  if (f < 0.67) return "elevated";
  return "high";
}

function Hero() {
  const { t } = useLocale();
  return (
    <header className="tab-hero tab-hero--warm">
      <span className="tab-hero__icon">
        <Icon name="clock" size={26} />
      </span>
      <div>
        <h3 className="tab-hero__title">{t("departure.title")}</h3>
        <p className="tab-hero__body">{t("departure.intro.body")}</p>
      </div>
    </header>
  );
}

function EmptyState() {
  const { t, d } = useLocale();
  const presets = usePresets();
  const setStart = useStore((s) => s.setStart);
  const setGoal = useStore((s) => s.setGoal);
  const plan = usePlan();
  const trip = presets?.trips?.[0] ?? null;
  return (
    <div className="tab-card tab-empty">
      <svg className="tab-empty__art" width="220" height="110" viewBox="0 0 220 110" aria-hidden="true">
        <path d="M10 100 A100 100 0 0 1 210 100" fill="none" stroke="var(--line)" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <circle cx="40" cy="62" r="9" fill="var(--amber-soft)" stroke="var(--amber)" strokeWidth="2" />
        <circle className="tab-empty__sun" cx="110" cy="12" r="14" fill="var(--sun)" />
        <circle cx="180" cy="62" r="9" fill="var(--plum-soft)" stroke="var(--plum)" strokeWidth="2" />
        <line x1="0" y1="100" x2="220" y2="100" stroke="var(--line)" strokeWidth="2" />
        <circle cx="52" cy="100" r="6" fill="var(--primary)" />
        <path d="M168 100s-8-7-8-13a8 8 0 0 1 16 0c0 6-8 13-8 13z" fill="var(--brick)" />
      </svg>
      <h4 className="tab-empty__title">{t("departure.empty.title")}</h4>
      <p className="tab-empty__body">{t("departure.empty.body")}</p>
      <div className="tab-empty__actions">
        {trip && (
          <Button
            variant="primary"
            onClick={() => {
              setStart(trip.from, d(trip.label));
              setGoal(trip.to, d(trip.label));
              void plan();
            }}
          >
            <Icon name="spark" size={18} />
            {t("departure.empty.sample")}
          </Button>
        )}
        <Link to="/app" className="btn btn--secondary">
          <Icon name="map" size={18} />
          {t("departure.empty.openMap")}
        </Link>
      </div>
    </div>
  );
}

function DepartureChart({ data }: { data: DepartureResponseT }) {
  const { t } = useLocale();
  const locale = useStore((s) => s.locale);
  const gid = useId().replace(/:/g, "");
  const pts = data.points.map((p) => ({ ts: new Date(p.tISO).getTime(), heat: p.heatMin, iso: p.tISO }));
  const minT = Math.min(...pts.map((p) => p.ts));
  const maxT = Math.max(...pts.map((p) => p.ts));
  const maxHeat = Math.max(1, ...pts.map((p) => p.heat));
  const minHeat = Math.min(...pts.map((p) => p.heat));
  const x = (ts: number) => PAD_L + ((ts - minT) / Math.max(1, maxT - minT)) * (W - PAD_L - PAD_R);
  const y = (h: number) => H - PAD_B - (h / maxHeat) * (H - PAD_T - PAD_B);
  const line = pts.map((p) => `${x(p.ts)},${y(p.heat)}`).join(" ");
  const area = `${x(pts[0].ts)},${H - PAD_B} ${line} ${x(pts[pts.length - 1].ts)},${H - PAD_B}`;
  const best = pts.reduce((a, b) => (b.heat < a.heat ? b : a));
  const worst = pts.reduce((a, b) => (b.heat > a.heat ? b : a));
  const bestTs = new Date(data.best.tISO).getTime();
  const bestX = x(Number.isFinite(bestTs) ? bestTs : best.ts);
  // Label at most ~5 ticks so they never collide.
  const MIN_TICK_GAP = 62;
  const ticks: typeof pts = [];
  for (const p of pts) {
    const last = ticks[ticks.length - 1];
    if (!last || x(p.ts) - x(last.ts) >= MIN_TICK_GAP) ticks.push(p);
  }
  // Callouts sit just above their own point; if they would collide, drop the
  // "coolest" one below its point instead.
  const CALL_W = 70;
  const callX = (px: number) => Math.min(W - PAD_R - CALL_W, Math.max(PAD_L, px - CALL_W / 2));
  const flat = maxHeat <= 0 || (maxHeat - minHeat) / maxHeat < FLAT_SPREAD;
  const hotX = callX(x(worst.ts));
  const hotY = Math.max(0, y(worst.heat) - 30);
  const coolX = callX(x(best.ts));
  let coolY = Math.max(0, y(best.heat) - 30);
  if (Math.abs(coolX - hotX) < CALL_W + 4 && Math.abs(coolY - hotY) < 24) coolY = y(best.heat) + 10;
  const yTicks = [0, maxHeat / 2, maxHeat];

  return (
    <figure className="dep-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("departure.chart.title")}>
        <defs>
          <linearGradient id={`da-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--brick)", stopOpacity: 0.32 }} />
            <stop offset="0.6" style={{ stopColor: "var(--amber)", stopOpacity: 0.16 }} />
            <stop offset="1" style={{ stopColor: "var(--necklace)", stopOpacity: 0.04 }} />
          </linearGradient>
          <linearGradient id={`dl-${gid}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: "var(--necklace)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--amber)" }} />
            <stop offset="1" style={{ stopColor: "var(--brick)" }} />
          </linearGradient>
        </defs>
        {/* decorative sun arc across the day */}
        <path
          d={`M${PAD_L} ${H - PAD_B} Q ${(PAD_L + W - PAD_R) / 2} ${PAD_T - 40} ${W - PAD_R} ${H - PAD_B}`}
          fill="none"
          stroke="var(--sun)"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          opacity="0.6"
        />
        {/* grid + y ticks */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className="dep-chart__tick">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {/* area + line */}
        <polygon points={area} fill={`url(#da-${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={`url(#dl-${gid})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dep-chart__line"
        />
        {/* best window marker */}
        <line x1={bestX} y1={PAD_T - 6} x2={bestX} y2={H - PAD_B} stroke="var(--necklace)" strokeWidth="2" strokeDasharray="4 4" />
        {/* points */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={x(p.ts)}
            cy={y(p.heat)}
            r={p === best || p === worst ? 6 : 4}
            className={`dep-chart__pt dep-chart__pt--${toneFor(p.heat, minHeat, maxHeat)}`}
          />
        ))}
        {/* coolest / hottest callouts (no "hottest" when the day is flat) */}
        <g className="dep-chart__callout dep-chart__callout--cool">
          <rect x={coolX} y={coolY} width={CALL_W} height="20" rx="10" />
          <text x={coolX + CALL_W / 2} y={coolY + 14} textAnchor="middle">
            {t("departure.coolest")}
          </text>
        </g>
        {!flat && worst !== best && (
          <g className="dep-chart__callout dep-chart__callout--hot">
            <rect x={hotX} y={hotY} width={CALL_W} height="20" rx="10" />
            <text x={hotX + CALL_W / 2} y={hotY + 14} textAnchor="middle">
              {t("departure.hottest")}
            </text>
          </g>
        )}
        {/* x ticks */}
        {ticks.map((p, i) => (
          <text key={i} x={x(p.ts)} y={H - PAD_B + 18} textAnchor="middle" className="dep-chart__tick">
            {formatTime(p.iso, locale)}
          </text>
        ))}
        {/* axis titles */}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 2} textAnchor="middle" className="dep-chart__axis">
          {t("departure.axisTime")}
        </text>
        <text x={12} y={(PAD_T + H - PAD_B) / 2} textAnchor="middle" className="dep-chart__axis" transform={`rotate(-90 12 ${(PAD_T + H - PAD_B) / 2})`}>
          {t("departure.axisHeat")}
        </text>
      </svg>
    </figure>
  );
}

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
    return (
      <section className="lab-tab departure-tab" aria-label={t("departure.title")}>
        <Hero />
        <EmptyState />
      </section>
    );
  }

  if (!data || data.points.length === 0) {
    return (
      <section className="lab-tab departure-tab" aria-label={t("departure.title")}>
        <Hero />
        <div className="tab-card tab-card--loading" role="status">
          <span className="tab-skeleton" />
          <span className="tab-skeleton tab-skeleton--short" />
          <span className="visually-hidden">{t("common.loading")}</span>
        </div>
      </section>
    );
  }

  const heats = data.points.map((p) => p.heatMin);
  const minHeat = Math.min(...heats);
  const maxHeat = Math.max(1, ...heats);
  const bestTs = new Date(data.best.tISO).getTime();

  return (
    <section className="lab-tab departure-tab" aria-label={t("departure.title")}>
      <Hero />
      <div className="tab-grid tab-grid--departure">
        <div className="tab-card best-card">
          <span className="best-card__eyebrow">
            <Icon name="walk" size={16} />
            {t("departure.leaveAt")}
          </span>
          <span className="best-card__time mono">{formatTime(data.best.tISO, locale)}</span>
          <span className="best-card__chip">
            <Icon name="leaf" size={14} />
            {t("departure.cooler", { reduction: formatPercent(data.best.reductionPct, locale) })}
          </span>
          <span className="best-card__sun" aria-hidden="true" />
        </div>

        <div className="tab-card tab-card--chart">
          <h4 className="tab-card__title">
            <Icon name="sun" size={18} />
            {t("departure.chart.title")}
          </h4>
          <DepartureChart data={data} />
        </div>

        <div className="tab-card dep-list-card">
          <h4 className="tab-card__title">
            <Icon name="clock" size={18} />
            {t("departure.list.title")}
          </h4>
          <ul className="dep-list">
            {data.points.map((p, i) => {
              const tone = toneFor(p.heatMin, minHeat, maxHeat);
              const isBest = new Date(p.tISO).getTime() === bestTs;
              return (
                <li key={i} className={`dep-list__row${isBest ? " dep-list__row--best" : ""}`}>
                  <span className="dep-list__time mono">{formatTime(p.tISO, locale)}</span>
                  <span className="dep-list__bar" aria-hidden="true">
                    <span
                      className={`dep-list__fill dep-list__fill--${tone}`}
                      style={{ width: `${Math.max(6, (p.heatMin / maxHeat) * 100)}%`, animationDelay: `${i * 60}ms` }}
                    />
                  </span>
                  <span className="dep-list__value">
                    {t("departure.heatValue", { minutes: formatMinutes(p.heatMin, locale) })}
                  </span>
                  {isBest && <span className="dep-list__tag">{t("departure.coolest")}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="tab-tip">
          <Icon name="info" size={18} />
          {t("departure.tip")}
        </p>
      </div>
    </section>
  );
}
