/**
 * watch/useClock.ts — a ticking wall clock for the watch face and status bar.
 *
 * Re-renders once a second (aligned to the second boundary) and formats the
 * time and date for the active locale via Intl. The time drops the AM/PM
 * marker, as a watch face does, so the digits stay large.
 */
import { useEffect, useState } from "react";

export interface ClockText {
  /** e.g. "10:09" (no day period). */
  time: string;
  /** e.g. "SAT". */
  weekday: string;
  /** e.g. "24". */
  day: string;
  /** e.g. "Saturday, October 24" — for screen readers. */
  longDate: string;
  now: Date;
}

export function useClock(locale: string): ClockText {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      setNow(new Date());
      id = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      clearTimeout(align);
      if (id) clearInterval(id);
    };
  }, []);

  let time: string;
  let weekday: string;
  let day: string;
  let longDate: string;
  try {
    time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" })
      .formatToParts(now)
      .filter((p) => p.type !== "dayPeriod")
      .map((p) => p.value)
      .join("")
      .trim();
    weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(now);
    day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(now);
    longDate = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
  } catch {
    time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    weekday = "";
    day = String(now.getDate());
    longDate = now.toDateString();
  }
  return { time, weekday, day, longDate, now };
}
