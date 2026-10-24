/**
 * api/usePresets.ts — load /api/presets once (weather presets, trips, zones).
 *
 * Used by the Lab to offer scenario presets and by the Navigator for trip
 * presets. Presets carry descriptor labels rendered via t().
 */
import { useEffect, useState } from "react";
import { useClient } from "./useClient";
import type { PresetsResponseT } from "@/api/types";

export function usePresets(): PresetsResponseT | null {
  const client = useClient();
  const [data, setData] = useState<PresetsResponseT | null>(null);

  useEffect(() => {
    let active = true;
    client
      .getPresets()
      .then((d) => active && setData(d))
      .catch(() => {
        /* presets are optional; controls still work without them */
      });
    return () => {
      active = false;
    };
  }, [client]);

  return data;
}
