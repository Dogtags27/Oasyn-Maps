/**
 * a11y/liveRegions.tsx — app-level polite/assertive live regions (R13.4).
 *
 * A tiny pub/sub plus two visually-hidden regions: polite for route/offer
 * updates, assertive for critical announcements. Components call announce() and
 * the matching region updates. The critical dialog manages its own assertive
 * countdown region; this is for app-wide status such as "routes updated".
 */
import { useEffect, useState } from "react";

type Politeness = "polite" | "assertive";
type Listener = (message: string, politeness: Politeness) => void;

const listeners = new Set<Listener>();

/** Announce a message to screen readers at the given politeness. */
export function announce(message: string, politeness: Politeness = "polite"): void {
  for (const l of listeners) l(message, politeness);
}

/** Mount once near the app root so announcements have somewhere to land. */
export function LiveRegions() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  useEffect(() => {
    const listener: Listener = (message, politeness) => {
      if (politeness === "assertive") setAssertive(message);
      else setPolite(message);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      <div className="visually-hidden" aria-live="polite" role="status">
        {polite}
      </div>
      <div className="visually-hidden" aria-live="assertive" role="alert">
        {assertive}
      </div>
    </>
  );
}
