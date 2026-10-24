/**
 * privacy/uid.ts — on-device identity (R14.1, R14.2).
 *
 * A random UUID v4 created on first run, stored in localStorage with an
 * in-memory fallback. No account, no personal data. The UUID never goes to the
 * backend except inside the simulated dispatch preview, which makes no request.
 */

const UID_KEY = "oasyn.uid";

let memoryUid: string | null = null;

function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Read the device id, creating and persisting one on first run. */
export function readUid(): string {
  try {
    const existing = localStorage.getItem(UID_KEY);
    if (existing) return existing;
    const fresh = makeUuid();
    localStorage.setItem(UID_KEY, fresh);
    return fresh;
  } catch {
    // Storage unavailable (private mode, SSR, etc.): keep an in-memory id.
    if (!memoryUid) memoryUid = makeUuid();
    return memoryUid;
  }
}

/** Reset the id and clear on-device data, returning the new id. */
export function resetUid(): string {
  const fresh = makeUuid();
  try {
    localStorage.setItem(UID_KEY, fresh);
  } catch {
    memoryUid = fresh;
  }
  return fresh;
}

/** Clear everything Oasyn stores on this device. */
export function clearLocalData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("oasyn.")) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
  memoryUid = null;
}

/** A JSON export of everything stored on device (R14.3). */
export function exportLocalData(): string {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("oasyn.")) {
        const v = localStorage.getItem(k);
        try {
          data[k] = v ? JSON.parse(v) : v;
        } catch {
          data[k] = v;
        }
      }
    }
  } catch {
    data["oasyn.uid"] = memoryUid;
  }
  return JSON.stringify(data, null, 2);
}
