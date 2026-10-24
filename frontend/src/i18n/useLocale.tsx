/**
 * i18n/useLocale.tsx — binds the active locale (from the store) to loaded
 * messages and a t() function, and keeps <html lang> in sync (R1.2, R12.5).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { makeT, type Messages, type TFn, type Vars } from "./t";
import { locales, DEFAULT_LOCALE } from "./locales";
import { useStore } from "@/store";
import en from "./locales/en.json";
import type { DescriptorT } from "@/api/types";

interface LocaleContextValue {
  locale: string;
  t: TFn;
  /** Render a backend Descriptor through t(). */
  d: (descriptor: DescriptorT | undefined) => string;
  ready: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useStore((s) => s.locale);
  // en is bundled so there is always a synchronous baseline before async loads.
  const [messages, setMessages] = useState<Messages>(en as Messages);
  const [ready, setReady] = useState(locale === DEFAULT_LOCALE);

  useEffect(() => {
    let active = true;
    const entry = locales[locale] ?? locales[DEFAULT_LOCALE];
    setReady(false);
    entry
      .load()
      .then((m) => {
        if (active) {
          // Merge over en so any missing key still resolves to the English string.
          setMessages({ ...(en as Messages), ...m });
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setMessages(en as Messages);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const t = makeT(messages, locale);
    const d = (descriptor: DescriptorT | undefined) =>
      descriptor ? t(descriptor.key, descriptor.vars as Vars | undefined) : "";
    return { locale, t, d, ready };
  }, [messages, locale, ready]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/** Convenience: the t() function alone. */
export function useT(): TFn {
  return useLocale().t;
}
