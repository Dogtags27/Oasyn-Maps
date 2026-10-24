/**
 * store/index.ts — the zustand root (R5, R7, R8, R13).
 *
 * One store is shared across every page and the watch so /watch (standalone or
 * embedded) stays in sync (R8.4). Slices: prefs, scenario, routes, walker,
 * offers, escalation, plus app-level flags (config, badges, reachability).
 *
 * The store holds NO thresholds; config is cached verbatim from /api/config and
 * read through typed accessors in config/.
 */
import { create } from "zustand";
import type {
  ConfigResponseT,
  RouteResultT,
  OfferT,
  ScenarioT,
  ModeT,
  LatLngT,
  ZoneT,
  EscalationStateT,
  DescriptorT,
} from "@/api/types";
import { DEFAULT_LOCALE, resolveLocale } from "@/i18n/locales";
import { readUid } from "@/privacy/uid";

export type PriorPreset = "fresh" | "30" | "60";
export type PlaybackSpeed = number;

export interface PrefsSlice {
  locale: string;
  tempUnit: "C" | "F";
  distanceUnit: "metric" | "imperial";
  sunMode: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  uid: string;
  consented: boolean;
}

export interface ScenarioSlice {
  scenario: ScenarioT;
  mode: ModeT;
  prior: PriorPreset;
  start: LatLngT | null;
  goal: LatLngT | null;
  /** Display label for `start` (place name, or null for a map-dropped pin). */
  startLabel: string | null;
  /** Display label for `goal` (place name, or null for a map-dropped pin). */
  goalLabel: string | null;
}

export interface RoutesSlice {
  routes: RouteResultT[];
  selectedId: string | null;
  recommendedId: string | null;
  noPath: boolean;
  planning: boolean;
}

export interface WalkerSlice {
  playing: boolean;
  simSec: number;
  speed: PlaybackSpeed;
  /** current accumulated exposure sampled from aTrace. */
  a: number;
  /** fractional position [0,1] along the selected route geometry. */
  progress: number;
}

export interface OffersSlice {
  offers: OfferT[];
  snoozeUntil: Record<string, number>;
  simulateAccepts: boolean;
}

export interface EscalationSlice {
  escalation: EscalationStateT;
}

/** A Lab event-log row (R7.4): trigger, decision, delta J, reason. */
export interface EventLogEntry {
  id: number;
  /** i18n key for the trigger label (e.g. "lab.event.heatSpike"). */
  triggerKey: string;
  /** i18n key for the decision (e.g. "lab.decision.offered"). */
  decisionKey: string;
  /** change in rank cost J from the replan, if any. */
  deltaJ: number | null;
  /** a backend descriptor explaining the decision, if any. */
  reason: DescriptorT | null;
}

export interface EventLogSlice {
  eventLog: EventLogEntry[];
}

export interface AppSlice {
  config: ConfigResponseT | null;
  sampleMode: boolean;
  unreachable: boolean;
  tilesFailed: boolean;
  /** A load failure (snapshot/layer) that should surface a notice + retry. */
  loadFailed: boolean;
  /** Live weather failed and the Heatwave preset was substituted (R15.1). */
  weatherFellBack: boolean;
}

export interface Store
  extends PrefsSlice,
    ScenarioSlice,
    RoutesSlice,
    WalkerSlice,
    OffersSlice,
    EscalationSlice,
    EventLogSlice,
    AppSlice {
  // prefs actions
  setLocale: (code: string) => void;
  setTempUnit: (u: "C" | "F") => void;
  setDistanceUnit: (u: "metric" | "imperial") => void;
  setSunMode: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
  setHighContrast: (on: boolean) => void;
  setConsented: (v: boolean) => void;
  setUid: (uid: string) => void;

  // scenario actions
  setScenario: (patch: Partial<ScenarioT>) => void;
  setMode: (m: ModeT) => void;
  setPrior: (p: PriorPreset) => void;
  setStart: (p: LatLngT | null, label?: string | null) => void;
  setGoal: (p: LatLngT | null, label?: string | null) => void;
  addZone: (z: ZoneT) => void;
  removeZoneAt: (at: LatLngT) => void;

  // routes actions
  setPlanning: (v: boolean) => void;
  setRoutes: (routes: RouteResultT[], recommendedId: string | null) => void;
  setNoPath: (v: boolean) => void;
  selectRoute: (id: string) => void;

  // walker actions
  setPlaying: (v: boolean) => void;
  setSpeed: (s: PlaybackSpeed) => void;
  setWalker: (patch: Partial<WalkerSlice>) => void;
  resetWalker: () => void;

  // offers actions
  setOffers: (offers: OfferT[]) => void;
  snoozeKind: (key: string, untilMs: number) => void;
  dismissOffer: (key: string) => void;
  setSimulateAccepts: (v: boolean) => void;

  // escalation actions
  setEscalation: (s: EscalationStateT) => void;

  // event-log actions
  logEvent: (entry: Omit<EventLogEntry, "id">) => void;
  clearEventLog: () => void;

  // app actions
  setConfig: (c: ConfigResponseT) => void;
  setSampleMode: (v: boolean) => void;
  setUnreachable: (v: boolean) => void;
  setTilesFailed: (v: boolean) => void;
  setLoadFailed: (v: boolean) => void;
  setWeatherFellBack: (v: boolean) => void;
}

const PREFS_KEY = "oasyn.prefs";

function loadPrefs(): Partial<PrefsSlice> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as Partial<PrefsSlice>;
  } catch {
    // ignore storage errors; fall through to defaults
  }
  return {};
}

function persistPrefs(p: PrefsSlice): void {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        locale: p.locale,
        tempUnit: p.tempUnit,
        distanceUnit: p.distanceUnit,
        sunMode: p.sunMode,
        consented: p.consented,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

function detectLocale(saved?: string): string {
  if (saved) return resolveLocale(saved);
  if (typeof navigator !== "undefined") return resolveLocale(navigator.language);
  return DEFAULT_LOCALE;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function prefersContrastMore(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-contrast: more)").matches
  );
}

const defaultScenario: ScenarioT = {
  timeISO: "2026-07-21T14:00:00-04:00",
  tempC: 32,
  rh: 50,
  cloud: 0.2,
  priorWalkMin: 0,
  stepFree: false,
  zones: [],
  liveWeather: false,
};

export const useStore = create<Store>((set, get) => {
  const saved = loadPrefs();
  const prefs: PrefsSlice = {
    locale: detectLocale(saved.locale),
    tempUnit: saved.tempUnit ?? "C",
    distanceUnit: saved.distanceUnit ?? "metric",
    sunMode: saved.sunMode ?? false,
    reducedMotion: prefersReducedMotion(),
    highContrast: prefersContrastMore(),
    uid: readUid(),
    consented: saved.consented ?? false,
  };

  const savePrefs = () => persistPrefs(get());

  return {
    // prefs
    ...prefs,
    setLocale: (code) => {
      set({ locale: resolveLocale(code) });
      savePrefs();
    },
    setTempUnit: (u) => {
      set({ tempUnit: u });
      savePrefs();
    },
    setDistanceUnit: (u) => {
      set({ distanceUnit: u });
      savePrefs();
    },
    setSunMode: (on) => {
      set({ sunMode: on });
      savePrefs();
    },
    setReducedMotion: (on) => set({ reducedMotion: on }),
    setHighContrast: (on) => set({ highContrast: on }),
    setConsented: (v) => {
      set({ consented: v });
      savePrefs();
    },
    setUid: (uid) => set({ uid }),

    // scenario
    scenario: defaultScenario,
    mode: "balanced",
    prior: "fresh",
    start: null,
    goal: null,
    startLabel: null,
    goalLabel: null,
    setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
    setMode: (m) => set({ mode: m }),
    setPrior: (p) => {
      const priorWalkMin = p === "fresh" ? 0 : p === "30" ? 30 : 60;
      set((s) => ({ prior: p, scenario: { ...s.scenario, priorWalkMin } }));
    },
    setStart: (p, label = null) => set({ start: p, startLabel: p ? label : null }),
    setGoal: (p, label = null) => set({ goal: p, goalLabel: p ? label : null }),
    addZone: (z) =>
      set((s) => ({ scenario: { ...s.scenario, zones: [...s.scenario.zones, z] } })),
    removeZoneAt: (at) =>
      set((s) => ({
        scenario: {
          ...s.scenario,
          zones: s.scenario.zones.filter(
            (z: ZoneT) =>
              Math.abs(z.center.lat - at.lat) > 1e-6 ||
              Math.abs(z.center.lng - at.lng) > 1e-6,
          ),
        },
      })),

    // routes
    routes: [],
    selectedId: null,
    recommendedId: null,
    noPath: false,
    planning: false,
    setPlanning: (v) => set({ planning: v }),
    setRoutes: (routes, recommendedId) =>
      set({
        routes,
        recommendedId,
        selectedId: recommendedId ?? routes[0]?.id ?? null,
        noPath: false,
      }),
    setNoPath: (v) => set({ noPath: v }),
    selectRoute: (id) => set({ selectedId: id }),

    // walker
    playing: false,
    simSec: 0,
    speed: 60,
    a: 0,
    progress: 0,
    setPlaying: (v) => set({ playing: v }),
    setSpeed: (s) => set({ speed: s }),
    setWalker: (patch) => set(patch),
    resetWalker: () => set({ playing: false, simSec: 0, a: 0, progress: 0 }),

    // offers
    offers: [],
    snoozeUntil: {},
    simulateAccepts: false,
    setOffers: (offers) => {
      const now = Date.now();
      const snooze = get().snoozeUntil;
      // Filter out snoozed kinds and expired offers.
      const visible = offers.filter(
        (o) => o.expiryMs > now && !(snooze[o.snoozeKey] && snooze[o.snoozeKey] > now),
      );
      set({ offers: visible });
    },
    snoozeKind: (key, untilMs) =>
      set((s) => ({
        snoozeUntil: { ...s.snoozeUntil, [key]: untilMs },
        offers: s.offers.filter((o) => o.snoozeKey !== key),
      })),
    dismissOffer: (key) =>
      set((s) => ({ offers: s.offers.filter((o) => o.snoozeKey !== key) })),
    setSimulateAccepts: (v) => set({ simulateAccepts: v }),

    // escalation
    escalation: { phase: "normal" },
    setEscalation: (s) => set({ escalation: s }),

    // event log
    eventLog: [],
    logEvent: (entry) =>
      set((s) => ({
        eventLog: [...s.eventLog, { ...entry, id: s.eventLog.length }],
      })),
    clearEventLog: () => set({ eventLog: [] }),

    // app
    config: null,
    sampleMode: false,
    unreachable: false,
    tilesFailed: false,
    loadFailed: false,
    weatherFellBack: false,
    setConfig: (c) => set({ config: c }),
    setSampleMode: (v) => set({ sampleMode: v }),
    setUnreachable: (v) => set({ unreachable: v }),
    setTilesFailed: (v) => set({ tilesFailed: v }),
    setLoadFailed: (v) => set({ loadFailed: v }),
    setWeatherFellBack: (v) => set({ weatherFellBack: v }),
  };
});

/** Selector: the currently selected route, if any. */
export function useSelectedRoute(): RouteResultT | null {
  return useStore((s) => s.routes.find((r) => r.id === s.selectedId) ?? null);
}
