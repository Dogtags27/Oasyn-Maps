# Kiro log — Oasyn Maps frontend (Person B)

Evidence of the Kiro-driven workflow for the frontend. The spec under
`.kiro/specs/oasyn-frontend/` (requirements, design, tasks) drove each hour; the
three always-on steering files (UI, i18n/accessibility, safety/privacy/content)
governed every change; save hooks ran the content and i18n checks; and the
build, tests, and gates ran from the CLI.

## Hours

- **Hour 1 — Scaffold, tokens, client, i18n, privacy, primitives.** Vite + React
  + TS package; `@theme` tokens + type + watch tokens; UI primitives (Button,
  Badge, Sheet, SegmentedControl, Dialog, FocusRing); API client with mock|live
  switch, request-id staleness, debounce; frontend-owned sample-data seed
  validated against the contract; config accessors; `t()` with Intl plurals +
  formatters, five locales, language switcher; privacy uid + consent card;
  content and no-hardcode gates.
- **Hour 2 — Map, art, route rendering, place search, directions.** Leaflet base
  with CARTO Positron tiles; in-house SVG glyphs; oasis/tree/park/safety layers;
  route rendering with the config ramp + high-heat tick overlay; provenance data
  badges; place search; screen-reader directions list.
- **Hour 3 — Store, Navigator, cards, Sun mode.** Zustand store across pages and
  the watch; Navigator bottom sheet; RouteCard with mode/prior segmented
  controls; Sun-mode auto-suggest. **Checkpoint 1:** plan channel flipped to live
  `/api/plan`.
- **Hour 4 — Offers, countdown, dispatch sim, wearable, watch.** OfferCard,
  CautionBanner, EstimateReadout, CriticalDialog with a local wall-clock
  countdown + draining ring, DispatchSim (no network), WearablePanel, and the
  full Watch (canvas, pager, four views, alert overlay, complications, `?bare=1`).
  **Checkpoint 2:** body + escalation channels live.
- **Hour 5 — Lab, playback, chart, log.** Lab shell with scenario/coverage/
  departure tabs; debounced controls to `/api/plan`; playback interpolating
  `aTrace`; replan events with offers + event log; exposure chart with config
  band lines; embedded watch preview. **Checkpoint 3:** coverage + departure live.
- **Hour 6 — Landing, translations, accessibility, resilience, Kiro evidence.**
  Landing page (hero + sections + media registry); translation parity verified;
  accessibility pass (live regions, reduced motion, contrast, landmarks);
  resilience notices (load-failure retry, weather fallback, tile fallback,
  badged sample mode); this log and the "Built with Kiro" section.

## Hard rules (enforced every hour)

- No user-facing string literals in components — everything through `t()` or a
  backend `Descriptor`.
- No colour outside `@theme` tokens (no-hex check).
- No hardcoded threshold — every model value read from `/api/config`.
- No emojis; sentence case; respectful content (lint:content).
- Verified each hour: typecheck, tests, `lint:content`, `lint:nohardcode`,
  `i18n:check`, and the production build.
