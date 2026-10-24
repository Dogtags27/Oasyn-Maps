/**
 * i18n/locales.ts — the locale registry (R12.1).
 *
 * Adding a language is one JSON file in ./locales plus one entry here. The
 * loader is lazy so only the active locale's messages are fetched.
 */
import type { Messages } from "./t";

export interface LocaleEntry {
  /** Language name in its own script, shown in the switcher. */
  nativeName: string;
  /** Lazy loader for the message table. */
  load: () => Promise<Messages>;
}

export const DEFAULT_LOCALE = "en";

export const locales: Record<string, LocaleEntry> = {
  en: {
    nativeName: "English",
    load: async () => (await import("./locales/en.json")).default as Messages,
  },
  es: {
    nativeName: "Español",
    load: async () => (await import("./locales/es.json")).default as Messages,
  },
  it: {
    nativeName: "Italiano",
    load: async () => (await import("./locales/it.json")).default as Messages,
  },
  "zh-Hans": {
    nativeName: "简体中文",
    load: async () => (await import("./locales/zh-Hans.json")).default as Messages,
  },
  ja: {
    nativeName: "日本語",
    load: async () => (await import("./locales/ja.json")).default as Messages,
  },
};

export const localeCodes = Object.keys(locales);

/** Map a browser language tag to a supported locale, falling back to default. */
export function resolveLocale(tag: string | undefined | null): string {
  if (!tag) return DEFAULT_LOCALE;
  if (tag in locales) return tag;
  // Match on the primary subtag (e.g. "es-MX" -> "es", "zh-Hant" -> none here).
  const primary = tag.split("-")[0];
  const hit = localeCodes.find((code) => code === primary || code.split("-")[0] === primary);
  return hit ?? DEFAULT_LOCALE;
}
