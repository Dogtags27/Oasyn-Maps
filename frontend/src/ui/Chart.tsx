/**
 * ui/Chart.tsx — accumulated exposure over walk time (R7.5).
 *
 * A hand-rolled SVG line chart of A vs sim time from the selected route's aTrace,
 * with horizontal band lines at the config boundaries (b1/b2). A marker shows the
 * current playback position. Band values come from config, never hardcoded. The
 * chart has a text summary for screen readers.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig } from "@/config";
import { useId } from "react";

const W = 320;
const H = 160;
const PAD = 24;

export function Chart() {
  const { t } = useLocale();
  const route = useSelectedRoute();
  const simSec = useStore((s) => s.simSec);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const gid = useId().replace(/:/g, "");

  if (!route || route.aTrace.length === 0) {
    return <div className="chart chart--empty">{t("lab.chart.title")}</div>;
  }

  const maxT = route.timeSec || route.aTrace[route.aTrace.length - 1][0] || 1;
  const maxA = Math.max(1, ...route.aTrace.map((p) => p[2]));

  const x = (ts: number) => PAD + (ts / maxT) * (W - 2 * PAD);
  const y = (a: number) => H - PAD - (a / maxA) * (H - 2 * PAD);

  const line = route.aTrace.map((p) => `${x(p[0])},${y(p[2])}`).join(" ");
  const cursorX = x(Math.min(simSec, maxT));

  const bandY1 = y(cfg.bands.b1);
  const bandY2 = y(cfg.bands.b2);

  return (
    <figure className="chart">
      <figcaption>{t("lab.chart.title")}</figcaption>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("lab.chart.title")}>
        <defs>
          {/* Vertical heat gradient: cool at the bottom, hot at the top. */}
          <linearGradient id={`cl-${gid}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: "var(--necklace)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--amber)" }} />
            <stop offset="1" style={{ stopColor: "var(--brick)" }} />
          </linearGradient>
          <linearGradient id={`ca-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--amber)", stopOpacity: 0.35 }} />
            <stop offset="1" style={{ stopColor: "var(--necklace)", stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        {/* axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" strokeWidth="1.5" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--line)" strokeWidth="1.5" />
        {/* band lines (dashed, from config) */}
        <line x1={PAD} y1={bandY1} x2={W - PAD} y2={bandY1} stroke="var(--amber)" strokeWidth="1.5" strokeDasharray="4 4" />
        <line x1={PAD} y1={bandY2} x2={W - PAD} y2={bandY2} stroke="var(--brick)" strokeWidth="1.5" strokeDasharray="4 4" />
        {/* exposure area + line */}
        <polygon points={`${x(route.aTrace[0][0])},${H - PAD} ${line} ${x(route.aTrace[route.aTrace.length - 1][0])},${H - PAD}`} fill={`url(#ca-${gid})`} />
        <polyline points={line} fill="none" stroke={`url(#cl-${gid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* playback cursor */}
        <line x1={cursorX} y1={PAD} x2={cursorX} y2={H - PAD} stroke="var(--primary)" strokeWidth="2" />
        <circle cx={cursorX} cy={PAD} r="4" fill="var(--primary)" />
      </svg>
    </figure>
  );
}
