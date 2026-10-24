/**
 * api/useClient.tsx — provides the ApiClient and boots /api/config (R2.6, R4.4).
 *
 * At boot we load config into the store so no threshold is hardcoded. The client
 * is wired to the store so mock mode sets the SAMPLE DATA badge and a live
 * failure flags `unreachable` (the UI then offers badged sample mode).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClient } from "./client";
import { useStore } from "@/store";

const ClientContext = createContext<ApiClient | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const setConfig = useStore((s) => s.setConfig);
  const setSampleMode = useStore((s) => s.setSampleMode);
  const setUnreachable = useStore((s) => s.setUnreachable);
  const [booted, setBooted] = useState(false);

  const client = useMemo(
    () =>
      new ApiClient({
        hooks: {
          onSampleMode: (active) => setSampleMode(active),
          onUnreachable: (v) => setUnreachable(v),
        },
      }),
    [setSampleMode, setUnreachable],
  );

  useEffect(() => {
    let active = true;
    client
      .getConfig()
      .then((cfg) => {
        if (active) {
          setConfig(cfg);
          setBooted(true);
        }
      })
      .catch(() => {
        // Live config failed: flag unreachable; the UI offers sample mode.
        if (active) setBooted(true);
      });
    return () => {
      active = false;
    };
  }, [client, setConfig]);

  // Render children immediately; components that need config read it from store.
  void booted;
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useClient(): ApiClient {
  const c = useContext(ClientContext);
  if (!c) throw new Error("useClient must be used within ClientProvider");
  return c;
}
