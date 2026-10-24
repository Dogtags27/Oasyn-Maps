# Design: Oasyn Maps frontend

This design realises the frontend requirements (Person B). The visual system is governed by the always-on steering files (UI, i18n/accessibility, safety/privacy/content); this file covers architecture, module layout, state, the client, and component wiring. **No domain logic, no thresholds** — everything that is a model value comes from `/api/config`, and all user-facing text comes from backend `Descriptor`s or local locale files rendered through `t()`.

## 1. High-level architecture

```text
                 ┌──────────────────────────── frontend (React + Vite) ────────────────────────────┐
browser routes   │  pages/          Landing  Navigator  Lab  Watch  Privacy  About                  │
  /              │     │                                                                            │
  /app           │     ├── store/ (zustand)  scenario · routes · walker · A · offers · escalation · │
  /lab           │     │                       locale · units · sunMode · uid · snooze              │
  /watch         │     ├── api/ client (mock|live) · request-id staleness · debounce · config cache │
  /privacy       │     ├── i18n/  t() · Intl formatters · locales/*.json · locales registry         │
  /about         │     ├── map/   Leaflet · CARTO tiles · route/layer renderers · SVG divIcons      │
                 │     ├── ui/     primitives (Button, Badge, Sheet, SegmentedControl, Dialog)      │
                 │     ├── safety/ offer card · caution banner · critical dialog · dispatch sim     │
                 │     ├── watch/  canvas views · pager · alert overlay · complications             │
                 │     ├── landing/ sections · media.ts registry                                    │
                 │     └── privacy/ uid.ts · consent card · export/reset                            │
                 └──────────────────────────────────────────────────────────────────────────────┘
                            │  only shared surface: backend/contract/ (schemas, messages, fixtures)
```

The frontend reads `GET /api/config` once at boot and caches it in the store. Every threshold, band, ramp step, cap, speed, event size and countdown length is read from there. The frontend never recomputes exposure, routing, scoring, or escalation decisions; it interpolates playback along `aTrace` and counts the countdown down from `deadlineMs`.

## 2. Module layout

```text
frontend/
  package.json  vite.config.ts  tsconfig.json  vitest.config.ts  index.html
  public/ (fonts, manifest, icons)
  src/
    main.tsx  App.tsx  router.tsx
    config/          # which keys we read from /api/config (typed accessors only)
    tokens/
      theme.css      # @theme tokens (paper, surface, ink, ink-2, necklace, amber, brick, charles, plum, sun)
      watch.css      # brightened watch tokens on black
      type.css       # font-face + :lang() stacks
    api/
      client.ts      # mock|live, request-id, debounce, stub/sample badge state
      mock.ts        # serves contract/fixtures; escalation lookup by (phase, event, tc)
      types.ts       # re-exports contract schema types (z.infer)
    store/
      index.ts       # zustand root
      scenario.ts routes.ts walker.ts offers.ts escalation.ts prefs.ts
    i18n/
      t.ts           # ~40-line t(): {var} interpolation + Intl.PluralRules
      locales.ts     # registry: code -> { nativeName, load() }
      formatters.ts  # Intl.NumberFormat/DateTimeFormat wrappers; C/F, m-km/ft-mi
      useLocale.ts
      locales/ en.json es.json it.json zh-Hans.json ja.json
    map/
      MapView.tsx  tiles.ts  RouteLayer.tsx  OasisLayer.tsx  TreeLayer.tsx
      ParkLayer.tsx  SafetyLayer.tsx  SunBadge.tsx  glyphs/ (SVG divIcon builders)
      fallbackArt.tsx  # graph-derived art when tiles fail
    ui/
      Button.tsx Badge.tsx Sheet.tsx SegmentedControl.tsx Dialog.tsx
      Legend.tsx RouteCard.tsx Chart.tsx FocusRing.css
    pages/
      Landing.tsx Navigator.tsx Lab.tsx Watch.tsx Privacy.tsx About.tsx
    landing/
      media.ts       # slot registry: { id, src?, kind, alt, caption }
      sections/ Hero.tsx Features.tsx HowItWorks.tsx DataHonesty.tsx WhoFor.tsx BuiltWithKiro.tsx
    safety/
      OfferCard.tsx CautionBanner.tsx CriticalDialog.tsx DispatchSim.tsx EstimateReadout.tsx WearablePanel.tsx
    watch/
      WatchCanvas.tsx Pager.tsx NextMove.tsx ExposureRing.tsx NearestOasis.tsx Body.tsx AlertOverlay.tsx Complications.tsx
    privacy/
      uid.ts ConsentCard.tsx
    a11y/
      DirectionsList.tsx  liveRegions.ts
  test/   # vitest: components + client + i18n parity + a11y smoke
```

## 3. API client and mock mode (R2)

`api/client.ts`:

- Mode from env (`VITE_API_MODE=mock|live`). Mock mode sets a global `SAMPLE DATA` badge via the store.
- `plan`, `replan`, `body`, `escalationStep`, `coverage`, `departure`, `getConfig`, `getMeta`, `getPresets`, `getLayer`.
- Each call carries an incrementing `requestId` per logical channel; responses with a stale id are dropped. Slider-driven calls are debounced (interval from config).
- On a network failure (live), set an `unreachable` flag; the UI offers sample mode (badged), never silently swaps.

`api/mock.ts`:

- Serves `backend/contract/fixtures/*.json`. For escalation, looks up a step by `(state.phase, event.type)` and whether `tcC` is at/above the caution/critical thresholds from config. Documented as sample-only; live is authoritative.

`config/`:

- Typed accessors over the cached `Config`. Components import `useConfig().bands`, `.ramp`, `.caps`, `.countdownMs`, etc. — never a literal.

## 4. State (R5, R7, R8, R9)

Zustand root split into slices:

- `scenario`: temp, rh, cloud, timeISO, live, priorMin, mode, safetyWeight, hr, hrBase, zones, start, goal, stepFree.
- `routes`: candidate `RouteResult[]`, selected id, fresh-walker comparison flag (from the response).
- `walker`: position, simMin, speed (x30/x60/x120), current `A`, `aTrace` cursor.
- `offers`: `offers[]`, per-kind `snoozeUntil`, "simulate user accepts" toggle (default off).
- `escalation`: phase, `deadlineMs`, local countdown derived from wall clock.
- `prefs`: locale, units (C/F, metric/imperial), sunMode, reducedMotion/contrast mirrors, uid.

The Watch reads the same store, so `/watch` (standalone or embedded) stays in sync. Playback interpolates the walker along geometry and advances `A` by sampling `aTrace` — no recompute.

## 5. Visual system (R3, R6)

`tokens/theme.css` defines the `@theme` palette; nothing outside the token set is allowed (no-hex lint). Shape: 1.5px ink borders, 10px radius, flat offset shadow `3px 3px 0 ink`, pressed state removes the shadow and shifts 2px. Type via `tokens/type.css` with `:lang()` stacks and tabular figures. Sun mode is a `data-sun` attribute on the root that swaps background/ink, bumps stroke width +2px, drops tiles to 50%, and promotes secondary text; `prefers-contrast: more` applies the same stroke/contrast bump. Reduced motion disables tweening and ring animation.

Badges (`ui/Badge.tsx`): mono uppercase pills, ink border — `LIVE` necklace, `SNAPSHOT` surface, `ESTIMATED` amber, `SIMULATED` plum (paper text), plus `SAMPLE DATA` for mock mode.

## 6. Map (R4)

`map/MapView.tsx` wraps Leaflet with keyboard enabled. CARTO Positron tiles at 70% (50% in Sun mode). Layers are React components that read the store and the loaded layer data:

- `RouteLayer`: 2px ink casing + 7px colour polyline; segment colour from the config ramp with a paper tick overlay on high-heat segments; alternatives ink-2 dashed 60%.
- `OasisLayer`, `TreeLayer` (zoom >= 16, grid-thinned, seeded rotation from a frontend mulberry32 keyed by node id for art only), `ParkLayer` (hatch), `SafetyLayer` (cross-hatch, dashed, SIMULATED).
- `SunBadge`: octagon rotated to the azimuth, elevation in mono.
- `glyphs/`: in-house SVG `divIcon` builders (cooling hexagon, water droplet, start ring, destination pennant, walker). No icon pack.
- `fallbackArt.tsx`: if tiles fail, draw graph-derived art on paper so the map area is never blank.
- Provenance: a tappable badge stack reads `meta.json` via `/api/meta` + `/api/layers`.

`Legend` reads the ramp from config and labels it "modeled exposure".

## 7. Navigator (R5, R6)

`pages/Navigator.tsx`: top bar (logo, Sun mode toggle, data-badge stack) + full-screen `MapView` + `ui/Sheet` with three snap points (peek 120px / half / full). Peek shows recommended time, heat-minutes, a one-line explanation descriptor, and a big Start button in the thumb zone. Half shows start/destination fields (preset list + "tap map"), the mode `SegmentedControl`, and the prior-exposure `SegmentedControl`. Full shows `RouteCard`s (time, distance, heat-min, shade %, arrival band, safety, oasis count), the explanation list, and the legend. Desktop promotes the sheet to a 400px left panel via a media query. No-path returns an inline notice and keeps prior state. Every sentence is a descriptor rendered with `t()`.

## 8. Lab (R7)

`pages/Lab.tsx`: three regions (controls / map+playback / metrics), collapsing to tabs under a phone breakpoint.

- Controls: sliders (temp, humidity, cloud, time, safety weight, simulated HR), prior-exposure and mode segmented controls, live-weather toggle, scenario presets, step-free toggle. Slider input is debounced before calling `/api/plan`.
- Map + playback bar: play/pause, x30/x60/x120. The walker advances `speed * 0.2s` of sim time per 200ms tick, interpolated on geometry; `A` comes from `aTrace`.
- Events: Heat spike, HR spike, Drop/remove safety zone, body-temp slider, any input change -> call `/api/replan` with walker position and current exposure; apply the returned offer (never auto-switch unless "simulate user accepts" is on).
- Metrics column: route metrics, `Chart` of accumulated exposure over walk time with band lines (band values from config), `WatchCanvas` preview, and the event log (trigger, decision, delta J, reason).
- Tabs "Coverage" and "Leave when" render `/api/coverage` and `/api/departure` results (T2).

## 9. Watch (R8)

`watch/WatchCanvas.tsx`: a 198x242pt canvas inside a drawn bezel, black background with brightened tokens from `tokens/watch.css`. `Pager` cycles Next move / Exposure ring / Nearest oasis / Body via wheel, arrow keys, swipe, tap. `AlertOverlay` interrupts any view with Switch/Keep and a haptic-pattern label (`navigator.vibrate` only when on a phone). `Complications` renders circular (exposure ring) and rectangular (next turn + band) on a mock face. `?bare=1` renders full-screen. All watch views read the shared store, so Lab playback drives them live. Street names truncate with ellipsis at es/it length.

## 10. Safety, offers, escalation UI (R9, R10)

- `OfferCard`: shows the backend-computed cost/benefit (delta time, delta heat) rendered via `t()`, equal-weight Accept / Not now (48px), visible expiry; "Not now" sets `snoozeUntil` for that kind. Route changes only on Accept.
- `CautionBanner`: amber band, ink border, leaf-in-triangle glyph, text + pattern, dismissible, includes "Prototype. Not a medical device." Shown when escalation phase is `caution`.
- `CriticalDialog`: full-screen, paper background, brick top rule with tick pattern, 64px Fraunces countdown with a draining ring. The countdown is derived locally from `escalation.deadlineMs` using the wall clock (`requestAnimationFrame` / interval), so it finishes even if the API goes away. "I am OK, cancel" is the largest control; "Get help now" is secondary. Reduced motion: the number updates, the ring does not animate. Announced assertively; countdown read every 10s.
- `DispatchSim`: shown if the countdown expires without cancel. Permanent plum `SIMULATION: no call was placed` banner, lists pseudonymous ID, modeled temperature with range, and location. Makes no network request.
- `EstimateReadout`: "about X C (range ... to ...), illustrative model" with a gauge-arc glyph; never a bare number, never a diagnosis.
- `WearablePanel`: `SIMULATED` panel, HR vs baseline, no diagnostic claims. The Lab body-temp slider feeds the escalation requests.

Escalation stepping: the frontend posts `/api/escalation/step` with `(state, tcUsed, now, action)` and renders the returned phase; the reducer logic lives in the backend. The local countdown is the only time the frontend uses wall-clock time for escalation, and it is real time, not playback time.

## 11. Landing (R11)

`pages/Landing.tsx` composes `Hero`, `Features` (six numbered rows alternating text/media), `HowItWorks`, `DataHonesty` (badge legend + sources), `WhoFor`, `BuiltWithKiro`, the language switcher, and a footer. `landing/media.ts` is the slot registry `{ id, src?, kind: 'image'|'video', alt, caption }`; until a `src` is set, a hatched placeholder with the caption renders. Every slot requires `alt` (or a transcript/caption). Video is muted and loops.

## 12. i18n (R12)

`i18n/t.ts` is a ~40-line `t(key, vars)`: `{var}` interpolation and `Intl.PluralRules` with `key_one`/`key_other` (ja and zh use `other` only). `locales.ts` maps code -> `{ nativeName, load() }`; adding a language is a new JSON file plus one registry entry. `formatters.ts` wraps `Intl.NumberFormat` (`style: 'unit'`) and `Intl.DateTimeFormat`, with C/F and metric/imperial toggles in `prefs`. The switcher uses native names, detects from `navigator.language`, persists locally, and sets `<html lang>`. CJK stacks and the no-uppercase/letter-spacing + line-height 1.6 rules apply via `:lang()`. `npm run i18n:check` fails on missing/extra/unused keys vs `en` and verifies every key in `backend/contract/messages.json` exists in `en.json`. Frontend-owned keys: `mode.*`, `preset.*`, `trip.*`.

## 13. Accessibility (R13)

- `a11y/DirectionsList.tsx` renders the selected route's turns as an ordered list, always present as the map's screen-reader equivalent.
- `liveRegions.ts` provides polite (routes/offers) and assertive (critical dialog) live regions; the countdown is announced every 10s.
- Keyboard: Leaflet keyboard enabled, a visible 3px focus ring, no traps, a searchable `places.json` destination list + presets so start/destination are settable without the map.
- `prefers-reduced-motion` and `prefers-contrast: more` are honoured (mirrored into `prefs`); layout holds at 200% text and 360px width. Step-free toggle sets the `stepFree` scenario flag passed to `/api/plan`. Every gesture has a button equivalent; tap targets >= 48px.

## 14. Privacy (R14)

`privacy/uid.ts` creates a UUID v4 with `crypto.randomUUID()`, stored in `localStorage` inside a try/catch with an in-memory fallback; exposes `reset()` and `export()`. The UUID never goes to the backend except inside the simulated dispatch preview (which makes no request). The Privacy page lists what is stored and what is sent (routing coordinates to the backend; CARTO tiles; optional Open-Meteo with 2-decimal coordinates, no UUID) and offers reset/delete and export (JSON). `ConsentCard` gates first run with translated copy; no analytics or tracking calls are made.

## 15. Resilience and content (R15, R16)

- Live-weather failure -> Heatwave preset + notice. Snapshot/layer failure -> full-screen notice + retry, prior state kept. Tiles failing -> `fallbackArt`. Backend unreachable -> notice + badged sample mode.
- `lint:content` (emoji + denylist) runs in CI and on save; a human pass covers all five languages. Safety zones are generic `SIMULATED` "caution areas". Icons stay abstract and brand-free; colour is never the only signal.

## 16. Testing strategy (vitest + testing-library)

- `client.test.ts`: mock/live switch; stale-response dropping by request id; debounce.
- `i18n.test.ts`: parity with `en`; plural forms for en/es/it, other-only for zh/ja; every backend message key exists in `en.json`.
- Component tests: `OfferCard` (Accept switches, Not now snoozes), `CriticalDialog` (local countdown from `deadlineMs`, reduced-motion ring), `DispatchSim` (no network call, permanent banner), `RouteLayer` (tick pattern on high-heat segments), `SegmentedControl` (keyboard).
- a11y smoke: one `h1` per page, directions list present for a selected route, focus ring visible, 360px no horizontal scroll.
- No-hardcode checks: `jsx-no-literals` (no sentence literals in JSX), no-hex (tokens only), no-emoji.

## 17. Technology choices

- React + Vite + TypeScript; zustand for state; Leaflet for the map; vitest + testing-library for tests.
- `zod` types reused from `backend/contract/schemas.ts` via `z.infer` so the client stays in lockstep with the contract.
- In-house `t()` and SVG glyphs (no icon pack, no heavy i18n framework) to keep the field-guide character and bundle small.

## 18. Checkpoints and mock-to-live

The client starts in mock mode on fixtures (hour 1). At Checkpoint 1 it flips to live `/api/plan`; at Checkpoint 2 the safety UI goes live; at Checkpoint 3 coverage and departure go live. The switch is a single env/config change because every call already matches the contract.

## 19. Open decisions (to confirm at scaffold)

1. State library: zustand (assumed) vs Redux Toolkit. Zustand matches the "same store across `/watch` and Lab" requirement with less ceremony.
2. Styling approach for tokens: CSS custom properties in `@theme` vs a Tailwind theme extension. The no-hex and token rules hold either way; the palette must come from the place, not Tailwind defaults.
3. Chart implementation: a small hand-rolled SVG chart (keeps the field-guide look, no dependency) vs a library. Leaning hand-rolled for the exposure-over-time chart.

Resolved: the Open-Meteo call is owned by the backend (backend R3.8); the frontend never calls Open-Meteo directly and only discloses it on the Privacy page.
