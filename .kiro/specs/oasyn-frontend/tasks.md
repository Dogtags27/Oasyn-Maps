# Tasks: Oasyn Maps frontend (Person B)

Person B edits `frontend/` only. Person B never edits `backend/` (including `backend/contract/`, which Person A owns); the frontend consumes the contract. Person B starts on mock data at hour 1 and flips to live at the checkpoints. Each task is incremental, builds on the previous ones, and ends with tests green.

Sample data: because `backend/contract/fixtures` may not exist yet when frontend work starts, Person B authors a frontend-owned sample-data seed under `frontend/src/api/sample/` (task 4.2). Mock mode prefers the backend fixtures when they exist and falls back to this seed otherwise, so hour-1 work is never blocked. The seed is schema-shaped and validated against the contract types.

Hard rules baked into every task: no user-facing string literals in components (use `t()`), no colour outside the `@theme` tokens, no threshold hardcoded (read `/api/config`), no emojis, sentence case. Enforced by `jsx-no-literals`, the no-hex check, `lint:content`, and `i18n:check`.

Tiers: **T1** = demo cannot run without it. **T2** = coverage, departure, polish. **T3** = stretch. Never cut: contract-driven rendering, escalation UI, offers-not-forced, i18n plumbing, accessibility basics, privacy page.

---

## Hour 1 — Scaffold, tokens, client, i18n, privacy, primitives

- [ ] 1. Scaffold the frontend package and tooling
  - Create `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `index.html`; add scripts (`dev`, `build`, `test`, `i18n:check`, `lint:content`, `lint:nohardcode` for `jsx-no-literals` + no-hex). Set up the router with `/`, `/app`, `/lab`, `/watch`, `/privacy`, `/about`.
  - _Requirements: R1.1, R1.2_

- [ ] 2. Design tokens and type
  - [ ] 2.1 `tokens/theme.css` with the `@theme` palette (paper, surface, ink, ink-2, necklace, amber, brick, charles, plum, sun); add the no-hex lint so no colour is used outside tokens.
    - _Requirements: R3.1, R3.2_
  - [ ] 2.2 `tokens/type.css` with Fraunces / Atkinson Hyperlegible Next / Mono, `:lang()` CJK stacks (Noto), tabular figures, `system-ui` fallback.
    - _Requirements: R3.4, R12.6_
  - [ ] 2.3 `tokens/watch.css` with brightened tokens on black.
    - _Requirements: R8.1_

- [ ] 3. UI primitives
  - `ui/Button.tsx` (ink/primary + paper/secondary, offset shadow, pressed shift), `Badge.tsx` (LIVE/SNAPSHOT/ESTIMATED/SIMULATED/SAMPLE DATA pills), `Sheet.tsx` (3 snap points), `SegmentedControl.tsx` (keyboard-operable), `Dialog.tsx`, `FocusRing.css` (3px). Enforce 48px tap targets and no emoji.
  - _Requirements: R3.3, R3.5, R3.6, R3.7, R13.3, R13.7_

- [ ] 4. API client with mock mode
  - [ ] 4.1 `api/types.ts` re-exporting contract schema types via `z.infer`; `api/client.ts` with mock|live switch, request-id staleness dropping, and debounce.
    - _Requirements: R2.1, R2.4, R2.5_
  - [ ] 4.2 Author the frontend-owned sample-data seed under `frontend/src/api/sample/` — one schema-shaped `kind: "sample"` JSON per endpoint (`meta`, `config`, `presets`, `layers.*`, `plan`, `replan`, `body`, `escalation`, `coverage`, `departure`) with illustrative Back Bay / Northeastern geometry and "Sample ..." resource names. Validate it against the contract `z.infer` types in a test. This unblocks all hour-1 frontend work before backend fixtures exist.
    - _Requirements: R2.2_
  - [ ] 4.3 `api/mock.ts`: resolve sample responses, preferring `backend/contract/fixtures` when present and falling back to the local `api/sample/` seed; escalation lookup by `(phase, event, tc)`; set the `SAMPLE DATA` badge in mock mode.
    - _Requirements: R2.2, R2.3, R2.8_
  - [ ] 4.4 Load `/api/config` at boot into the store; add typed `config/` accessors so no threshold is hardcoded; unreachable-backend notice + badged sample-mode offer.
    - _Requirements: R2.6, R2.7, R1.4_

- [ ] 5. i18n plumbing (from task 1, retrofitting is expensive)
  - [ ] 5.1 `i18n/t.ts` (`{var}` interpolation + `Intl.PluralRules`), `locales.ts` registry, `useLocale.ts`, `formatters.ts` (Intl number/date, C/F, metric/imperial).
    - _Requirements: R12.1, R12.2, R12.3, R12.4_
  - [ ] 5.2 `locales/en.json` authored first; header language switcher (native names), `navigator.language` detection, local persistence, `<html lang>`.
    - _Requirements: R12.5, R12.8_
  - [ ] 5.3 `i18n:check` script: parity/unused vs `en`, and every key in `backend/contract/messages.json` exists in `en.json`; add the save hook.
    - _Requirements: R12.7_

- [ ] 6. Privacy foundation
  - `privacy/uid.ts` (`crypto.randomUUID()`, localStorage + in-memory fallback, reset/export); `ConsentCard.tsx` gating first run (translated). No analytics/tracking.
  - _Requirements: R14.1, R14.2, R14.4_

- [ ] 7. Content and no-hardcode gates
  - `lint:content` (emoji + denylist) and `jsx-no-literals`; wire into test/CI and the save hook.
  - _Requirements: R3.7, R16.2, R12.2_

---

## Hour 2 — Map, art, route rendering, place search, directions

- [ ] 8. Map base
  - `map/MapView.tsx` (Leaflet, keyboard enabled) centred on Northeastern with CARTO Positron tiles at 70%; `fallbackArt.tsx` graph-derived art when tiles fail.
  - _Requirements: R4.1, R4.6, R13.3_

- [ ] 9. SVG glyphs and resource/feature layers
  - `map/glyphs/` in-house `divIcon` builders (cooling hexagon, water droplet, start ring, destination pennant, walker — all ink-outlined, abstract, brand-free); `OasisLayer`, `TreeLayer` (zoom >= 16, grid-thinned, seeded rotation), `ParkLayer` (hatch), `SafetyLayer` (cross-hatch, dashed, SIMULATED), `SunBadge` (rotated to azimuth, mono elevation).
  - _Requirements: R4.4, R16.1, R16.3_

- [ ] 10. Route rendering
  - `map/RouteLayer.tsx`: 2px ink casing + 7px colour line; segment colour from the config ramp with a paper tick overlay on high-heat segments; alternatives ink-2 dashed 60%; `ui/Legend.tsx` labelled "modeled exposure".
  - _Requirements: R4.2, R4.3, R16.4_

- [ ] 11. Provenance badges
  - Tappable data-badge stack reading `meta.json` via `/api/meta` + `/api/layers`; per-layer source lines.
  - _Requirements: R4.7, R15.3_

- [ ] 12. Place search and screen-reader directions
  - Searchable `places.json` destination list + presets so start/destination are settable without the map; `a11y/DirectionsList.tsx` rendering the selected route's turns from descriptors.
  - _Requirements: R13.2, R13.3, R5.5_

---

## Hour 3 — Store, Navigator, cards, Sun mode (Checkpoint 1: flip to live)

- [ ] 13. Store
  - `store/` slices (scenario, routes, walker, offers, escalation, prefs) in zustand; shared across pages and the watch.
  - _Requirements: R5, R7, R8.4_

- [ ] 14. Navigator page
  - [ ] 14.1 `pages/Navigator.tsx`: top bar (logo, Sun mode toggle, data-badge stack) + full-screen map + `Sheet` with peek/half/full; desktop 400px left panel.
    - _Requirements: R5.1, R5.2, R5.7_
  - [ ] 14.2 Set start/destination by map tap or preset -> plan request; render ranked routes; no-path inline notice keeping prior state.
    - _Requirements: R5.3, R5.6_
  - [ ] 14.3 `ui/RouteCard.tsx`: time, distance, heat-min, shade %, arrival band, safety, oasis count; prior-exposure (Fresh/30/60) and mode (Fastest/Balanced/Coolest) segmented controls; explanation list from descriptors via `t()`.
    - _Requirements: R5.4, R5.5, R5.8_

- [ ] 15. Sun mode and mobile
  - Sun mode toggle + auto-suggest when sun elevation > config threshold (pure white/black, +2px strokes, 50% tiles, promoted secondary text); verify 360px no-scroll and 200% text hold.
  - _Requirements: R6.1, R6.2, R6.3_

- [ ] 16. Flip the client to live `/api/plan` (Checkpoint 1)
  - Switch the plan channel to live; confirm every rendered value/sentence comes from the response (descriptors) and config (thresholds), not literals.
  - _Requirements: R2.6, R5.8, R1.4_

---

## Hour 4 — Offers, countdown, dispatch sim, wearable, watch (Checkpoint 2: safety UI live)

- [ ] 17. Offer card
  - `safety/OfferCard.tsx`: backend cost/benefit via `t()`, equal-weight Accept/Not now (48px), visible expiry, no silent dismiss; "Not now" snoozes that kind; route changes only on Accept.
  - _Requirements: R9.1, R9.2_

- [ ] 18. Caution banner and estimate readout
  - `safety/CautionBanner.tsx` (amber, leaf-in-triangle glyph, text + pattern, dismissible, "Prototype. Not a medical device."); `safety/EstimateReadout.tsx` ("about X C (range ...), illustrative model", gauge-arc glyph, never a bare number).
  - _Requirements: R9.3, R9.8_

- [ ] 19. Critical dialog and dispatch sim
  - [ ] 19.1 `safety/CriticalDialog.tsx`: full-screen, paper bg, brick tick top rule, 64px Fraunces countdown + draining ring; countdown derived locally from `deadlineMs` using the wall clock (survives API loss); "I am OK, cancel" largest; reduced-motion ring static; assertive aria-live; announce every 10s.
    - _Requirements: R9.4, R9.5, R9.7, R13.4_
  - [ ] 19.2 `safety/DispatchSim.tsx`: permanent `SIMULATION: no call was placed` banner; lists pseudonymous ID, modeled temp with range, location; makes no network request.
    - _Requirements: R9.6, R14.2_

- [ ] 20. Wearable panel
  - `safety/WearablePanel.tsx`: `SIMULATED`, HR vs baseline, no diagnostic claims; wire to surface the backend offer when HR/body-temp margins are exceeded.
  - _Requirements: R10.1, R10.2_

- [ ] 21. Watch
  - [ ] 21.1 `watch/WatchCanvas.tsx` (198x242pt, drawn bezel, black bg, brightened tokens) + `Pager` (wheel/arrow/swipe/tap); views `NextMove`, `ExposureRing`, `NearestOasis`, `Body` (SIMULATED).
    - _Requirements: R8.1, R8.2, R8.3_
  - [ ] 21.2 `AlertOverlay` (Switch/Keep + haptic-pattern label, `navigator.vibrate` only on phone); `Complications`; `?bare=1` full-screen; sync via shared store.
    - _Requirements: R8.4, R8.5, R8.6, R8.7, R9.1_

- [ ] 22. Safety UI live (Checkpoint 2)
  - Flip body/escalation channels to live `/api/body` and `/api/escalation/step`; confirm the reducer phase comes from the backend and only the local countdown uses wall-clock time.
  - _Requirements: R9.5, R10.2_

---

## Hour 5 — Lab, playback, chart, log (Checkpoint 3: coverage/departure live)

- [ ] 23. Lab shell and controls
  - `pages/Lab.tsx`: three regions -> tabs on phone; controls (temp, humidity, cloud, time, prior exposure, mode, safety weight, simulated HR, live-weather toggle, presets, step-free toggle); debounce slider input to `/api/plan`.
  - _Requirements: R7.1, R13.6_

- [ ] 24. Playback and events
  - Walker animation at x30/x60/x120 interpolating `aTrace` (no recompute); events (heat spike, HR spike, drop/remove zone, body-temp slider, input change) -> `/api/replan` -> offer only past hysteresis or on hard block; "simulate user accepts" toggle (default off); drop/remove zones by map tap (SIMULATED).
  - _Requirements: R7.2, R7.3, R7.6, R9.2_

- [ ] 25. Chart, event log, watch preview
  - `ui/Chart.tsx` accumulated exposure over walk time with band lines (bands from config); event log (trigger, decision, delta J, reason); embed the `WatchCanvas` preview synced to playback.
  - _Requirements: R7.4, R7.5, R7.7_

- [ ] 26. Coverage and departure tabs (Checkpoint 3) **[T2]**
  - Lab "Coverage" tab: minutes-to-nearest-oasis layer + share within 5/10 min + suggested top-k sites labelled heuristic (from `/api/coverage`). Lab "Leave when" tab: heat-minutes vs departure-time curve + best window (from `/api/departure`).
  - _Requirements: R17.1, R17.2_

---

## Hour 6 — Landing, translations, accessibility, polish

- [ ] 27. Landing page **[T1]**
  - [ ] 27.1 `landing/sections/Hero.tsx` (logo, Fraunces headline, subline, CTAs) + SVG street-grid illustration; `Features` six numbered text/media rows.
    - _Requirements: R11.1, R11.2_
  - [ ] 27.2 `HowItWorks`, `DataHonesty` (badge legend + sources), `WhoFor`, `BuiltWithKiro`, footer, language switcher; `landing/media.ts` registry with hatched placeholders, `alt`/caption required, muted looping video.
    - _Requirements: R11.2, R11.3, R18.1_

- [ ] 28. Translations **[T1]**
  - Author `es`, `it`, `zh-Hans`, `ja` locale files (AI-drafted, marked as such); verify `i18n:check` passes; CJK no-uppercase/letter-spacing + line-height 1.6; test every screen at Spanish length; watch street-name ellipsis at es/it.
  - _Requirements: R12.1, R12.6, R12.7_

- [ ] 29. Accessibility pass **[T1]**
  - `aria-live` wiring (polite routes/offers, assertive critical + 10s countdown); `prefers-reduced-motion` and `prefers-contrast: more`; one `h1` per page, ordered headings, landmarks; 200% text and 360px hold; button equivalents for every gesture; directions list present for every selected route.
  - _Requirements: R13.1, R13.2, R13.4, R13.5, R13.7_

- [ ] 30. Privacy and resilience pass **[T1]**
  - Privacy page (show ID, reset-and-delete, export JSON, list of stored/sent, CARTO + Open-Meteo disclosures); live-weather failure -> Heatwave preset + notice; snapshot/layer failure -> notice + retry; tiles -> fallback art; backend unreachable -> badged sample mode.
  - _Requirements: R14.3, R15.1, R15.2, R15.3_

- [ ] 31. Kiro evidence (frontend share) **[T1]**
  - Frontend `KIRO_LOG.md` lines; confirm the three always-on steering files govern frontend work; the "Built with Kiro" landing section references spec/steering/hooks/CLI.
  - _Requirements: R18.1_

- [ ] 32. PWA (stretch) **[T3]**
  - App-shell caching; opens offline and states routing needs a connection.
  - _Requirements: R17.3_
