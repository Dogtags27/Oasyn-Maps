/**
 * lab/usePlayback.ts — the Lab playback loop (R7.2).
 *
 * Every 200ms tick advances sim time by speed * 0.2s, updating the walker's
 * progress and sampling A from the selected route's aTrace. Reduced motion stops
 * the tween (the walker jumps on explicit steps only). Stops at the route end.
 */
import { useEffect, useRef } from "react";
import { useStore, useSelectedRoute } from "@/store";
import { exposureAt, progressAt } from "./playback";

const TICK_MS = 200;

export function usePlayback() {
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const setWalker = useStore((s) => s.setWalker);
  const setPlaying = useStore((s) => s.setPlaying);
  const route = useSelectedRoute();
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const id = setInterval(() => {
      const r = routeRef.current;
      if (!r) return;
      const s = useStore.getState();
      const nextSimSec = s.simSec + speed * (TICK_MS / 1000);
      if (nextSimSec >= r.timeSec) {
        setWalker({
          simSec: r.timeSec,
          progress: 1,
          a: exposureAt(r, r.timeSec),
        });
        setPlaying(false);
        return;
      }
      setWalker({
        simSec: nextSimSec,
        progress: progressAt(r, nextSimSec),
        a: exposureAt(r, nextSimSec),
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, speed, reducedMotion, setWalker, setPlaying]);
}
