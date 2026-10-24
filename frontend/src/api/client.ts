/**
 * api/client.ts — the API client (R2).
 *
 * - Mode from env (VITE_API_MODE = mock | live). Mock mode flags SAMPLE DATA.
 * - Every call carries an incrementing requestId per logical channel; a response
 *   whose id is no longer the latest for its channel is dropped (R2.4).
 * - Slider-driven calls go through `debouncedPlan` (interval from config) (R2.5).
 * - On a live network failure the client flags `unreachable`; the UI then offers
 *   badged sample mode, never a silent swap (R2.7).
 *
 * The client validates requests and (in dev) responses against the contract
 * schemas so the frontend stays in lockstep with the backend.
 */
import {
  PlanRequest,
  PlanResponse,
  ReplanRequest,
  ReplanResponse,
  BodyRequest,
  BodyResponse,
  EscalationRequest,
  EscalationResponse,
  CoverageRequest,
  CoverageResponse,
  DepartureRequest,
  DepartureResponse,
  MetaResponse,
  PresetsResponse,
  LayerResponse,
  LayerName,
} from "./types";
import type {
  PlanRequestT,
  PlanResponseT,
  ReplanRequestT,
  ReplanResponseT,
  BodyRequestT,
  BodyResponseT,
  EscalationRequestT,
  EscalationResponseT,
  CoverageRequestT,
  CoverageResponseT,
  DepartureRequestT,
  DepartureResponseT,
  MetaResponseT,
  ConfigResponseT,
  PresetsResponseT,
  LayerResponseT,
  LayerNameT,
} from "./types";
import { resolveSample, resolveLayerSample, mockEscalationStep } from "./mock";
import { viewConfig } from "@/config";

export type ClientMode = "mock" | "live";

export interface ClientHooks {
  /** Called when mock mode is active so the UI can show the SAMPLE DATA badge. */
  onSampleMode?: (active: boolean) => void;
  /** Called when a live request fails at the network level. */
  onUnreachable?: (unreachable: boolean) => void;
}

/** A request whose id is stale (superseded by a newer call on its channel). */
export class StaleResponseError extends Error {
  constructor() {
    super("stale response");
    this.name = "StaleResponseError";
  }
}

function envMode(): ClientMode {
  const m = (import.meta.env?.VITE_API_MODE as string | undefined) ?? "mock";
  return m === "live" ? "live" : "mock";
}

function envBase(): string {
  return (
    (import.meta.env?.VITE_API_BASE as string | undefined) ??
    "https://oasyn-maps.onrender.com"
  );
}

export class ApiClient {
  mode: ClientMode;
  private base: string;
  private hooks: ClientHooks;
  /** Latest request id issued per logical channel. */
  private latest: Record<string, number> = {};
  private seq = 0;
  /** Cached config so thresholds/debounce are available to the client itself. */
  private cfg: ConfigResponseT | null = null;

  constructor(opts?: { mode?: ClientMode; base?: string; hooks?: ClientHooks }) {
    this.mode = opts?.mode ?? envMode();
    this.base = opts?.base ?? envBase();
    this.hooks = opts?.hooks ?? {};
    if (this.mode === "mock") this.hooks.onSampleMode?.(true);
  }

  /** Switch mode at runtime (e.g. accepting badged sample mode). */
  setMode(mode: ClientMode): void {
    this.mode = mode;
    this.hooks.onSampleMode?.(mode === "mock");
    if (mode === "mock") this.hooks.onUnreachable?.(false);
  }

  /** Issue the next id for a channel and record it as the latest. */
  private nextId(channel: string): number {
    const id = ++this.seq;
    this.latest[channel] = id;
    return id;
  }

  /** Throw if this id is no longer the latest for its channel. */
  private assertFresh(channel: string, id: number): void {
    if (this.latest[channel] !== id) throw new StaleResponseError();
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`);
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }

  /** Wrap live calls so a network failure flags unreachable and rethrows. */
  private async live<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const out = await fn();
      this.hooks.onUnreachable?.(false);
      return out;
    } catch (err) {
      // Network-level failures (fetch rejects) mark the backend unreachable.
      if (err instanceof TypeError) this.hooks.onUnreachable?.(true);
      throw err;
    }
  }

  // --- boot data ---------------------------------------------------------

  async getConfig(): Promise<ConfigResponseT> {
    const cfg =
      this.mode === "mock"
        ? resolveSample<ConfigResponseT>("config")
        : await this.live(() => this.get<ConfigResponseT>("/api/config"));
    this.cfg = cfg;
    return cfg;
  }

  async getMeta(): Promise<MetaResponseT> {
    const raw =
      this.mode === "mock"
        ? resolveSample<MetaResponseT>("meta")
        : await this.live(() => this.get<MetaResponseT>("/api/meta"));
    return MetaResponse.parse(raw);
  }

  async getPresets(): Promise<PresetsResponseT> {
    const raw =
      this.mode === "mock"
        ? resolveSample<PresetsResponseT>("presets")
        : await this.live(() => this.get<PresetsResponseT>("/api/presets"));
    return PresetsResponse.parse(raw);
  }

  async getLayer(name: LayerNameT): Promise<LayerResponseT> {
    LayerName.parse(name);
    const raw =
      this.mode === "mock"
        ? resolveLayerSample<LayerResponseT>(name)
        : await this.live(() => this.get<LayerResponseT>(`/api/layers/${name}`));
    return LayerResponse.parse(raw);
  }

  // --- planning channels -------------------------------------------------

  async plan(req: PlanRequestT): Promise<PlanResponseT> {
    const id = this.nextId("plan");
    const body = PlanRequest.parse(req);
    const raw =
      this.mode === "mock"
        ? resolveSample<PlanResponseT>("plan")
        : await this.live(() => this.post<PlanResponseT>("/api/plan", body));
    this.assertFresh("plan", id);
    return PlanResponse.parse(raw);
  }

  async replan(req: ReplanRequestT): Promise<ReplanResponseT> {
    const id = this.nextId("replan");
    const body = ReplanRequest.parse(req);
    const raw =
      this.mode === "mock"
        ? resolveSample<ReplanResponseT>("replan")
        : await this.live(() => this.post<ReplanResponseT>("/api/replan", body));
    this.assertFresh("replan", id);
    return ReplanResponse.parse(raw);
  }

  async body(req: BodyRequestT): Promise<BodyResponseT> {
    const id = this.nextId("body");
    const reqBody = BodyRequest.parse(req);
    const raw =
      this.mode === "mock"
        ? resolveSample<BodyResponseT>("body")
        : await this.live(() => this.post<BodyResponseT>("/api/body", reqBody));
    this.assertFresh("body", id);
    return BodyResponse.parse(raw);
  }

  async escalationStep(req: EscalationRequestT): Promise<EscalationResponseT> {
    const id = this.nextId("escalation");
    const body = EscalationRequest.parse(req);
    let raw: EscalationResponseT;
    if (this.mode === "mock") {
      const cfg = viewConfig(this.cfg);
      raw = mockEscalationStep({
        state: body.state,
        tcUsed: body.tcUsed,
        nowMs: body.nowMs,
        action: body.action,
        T1: cfg.escalation.T1,
        T2: cfg.escalation.T2,
        countdownSec: cfg.escalation.countdownSec,
      });
    } else {
      raw = await this.live(() =>
        this.post<EscalationResponseT>("/api/escalation/step", body),
      );
    }
    this.assertFresh("escalation", id);
    return EscalationResponse.parse(raw);
  }

  async coverage(req: CoverageRequestT): Promise<CoverageResponseT> {
    const id = this.nextId("coverage");
    const body = CoverageRequest.parse(req);
    const raw =
      this.mode === "mock"
        ? resolveSample<CoverageResponseT>("coverage")
        : await this.live(() => this.post<CoverageResponseT>("/api/coverage", body));
    this.assertFresh("coverage", id);
    return CoverageResponse.parse(raw);
  }

  async departure(req: DepartureRequestT): Promise<DepartureResponseT> {
    const id = this.nextId("departure");
    const body = DepartureRequest.parse(req);
    const raw =
      this.mode === "mock"
        ? resolveSample<DepartureResponseT>("departure")
        : await this.live(() => this.post<DepartureResponseT>("/api/departure", body));
    this.assertFresh("departure", id);
    return DepartureResponse.parse(raw);
  }
}

/**
 * Debounce helper for slider-driven calls (R2.5). Returns a function that delays
 * invocation by `waitMs`; only the last call within the window runs.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
