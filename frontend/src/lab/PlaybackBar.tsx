/**
 * lab/PlaybackBar.tsx — playback transport + event triggers (R7.2, R7.3, R7.6).
 *
 * Play/pause and speed (x30/x60/x120 from config). Event buttons (heat spike,
 * HR spike) nudge the scenario and call /api/replan at the current walker
 * position; the backend decides whether to offer (past hysteresis or a hard
 * block). "Simulate user accepts" (default off) auto-applies an offered route.
 * Each event is written to the event log with the backend's decision.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore, useSelectedRoute } from "@/store";
import { viewConfig } from "@/config";
import { useReplan } from "@/api/useReplan";
import { positionAt } from "./playback";
import { Button } from "@/ui/Button";
import { SegmentedControl } from "@/ui/SegmentedControl";

export function PlaybackBar() {
  const { t } = useLocale();
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const progress = useStore((s) => s.progress);
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const simulateAccepts = useStore((s) => s.simulateAccepts);
  const setSimulateAccepts = useStore((s) => s.setSimulateAccepts);
  const selectRoute = useStore((s) => s.selectRoute);
  const logEvent = useStore((s) => s.logEvent);
  const config = useStore((s) => s.config);
  const cfg = viewConfig(config);
  const route = useSelectedRoute();
  const replan = useReplan();

  const speedOptions = cfg.playbackSpeeds.map((s) => ({
    value: String(s),
    label: `x${s}`,
  }));

  async function fireEvent(triggerKey: string, patch: Partial<typeof scenario>) {
    setScenario(patch);
    const pos = route ? positionAt(route, progress) : null;
    if (!pos) {
      logEvent({ triggerKey, decisionKey: "lab.decision.noChange", deltaJ: null, reason: null });
      return;
    }
    const res = await replan(pos);
    const offer = res?.offers?.[0] ?? null;
    if (!offer) {
      logEvent({ triggerKey, decisionKey: "lab.decision.noChange", deltaJ: null, reason: null });
      return;
    }
    if (simulateAccepts && offer.routeId) {
      selectRoute(offer.routeId);
      logEvent({
        triggerKey,
        decisionKey: "lab.decision.accepted",
        deltaJ: offer.deltaJ,
        reason: offer.trigger,
      });
    } else {
      logEvent({
        triggerKey,
        decisionKey: "lab.decision.offered",
        deltaJ: offer.deltaJ,
        reason: offer.trigger,
      });
    }
  }

  return (
    <div className="playback-bar">
      <div className="playback-bar__transport">
        <Button variant="primary" onClick={() => setPlaying(!playing)} aria-pressed={playing}>
          {playing ? t("lab.playback.pause") : t("lab.playback.play")}
        </Button>
        <SegmentedControl
          ariaLabel={t("lab.playback.speed")}
          options={speedOptions}
          value={String(speed)}
          onChange={(v) => setSpeed(Number(v))}
        />
      </div>

      <div className="playback-bar__events">
        <Button
          variant="secondary"
          onClick={() => void fireEvent("lab.event.heatSpike", { tempC: scenario.tempC + 4 })}
        >
          {t("lab.event.heatSpike")}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void fireEvent("lab.event.hrSpike", { hr: (scenario.hr ?? 70) + 25 })
          }
        >
          {t("lab.event.hrSpike")}
        </Button>
      </div>

      <label className="playback-bar__sim">
        <input
          type="checkbox"
          checked={simulateAccepts}
          onChange={(e) => setSimulateAccepts(e.target.checked)}
        />
        {t("lab.simulateAccepts")}
      </label>
    </div>
  );
}
