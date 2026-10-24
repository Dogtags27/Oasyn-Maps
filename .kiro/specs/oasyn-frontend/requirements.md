# Requirements: Oasyn Maps frontend

## Introduction

Oasyn Maps is heat-aware walking navigation. This document specifies the **frontend** scope only (Person B): the React application, its visual system, the Navigator / Lab / Watch / Landing screens, i18n, accessibility, privacy UI, and the safety/offer/escalation UI flows. All domain computation lives in the backend (`.kiro/specs/oasyn-backend`); the two sides meet only at `backend/contract/` (zod schemas, a message-key catalog, and validated sample fixtures).

### The hard boundary (why this exists)

**The frontend contains no domain logic and no thresholds.** It reads bands, ramp steps, limits, speeds, event sizes, and countdown length from `/api/config`. It renders backend `Descriptor { key, vars }` values with `t(key, vars)`; it never hardcodes a user-facing sentence and never recomputes exposure, routing, scoring, or escalation decisions. Where the UI needs to animate (walker, countdown), it interpolates along data the backend already produced (`aTrace`, `deadlineMs`).

### Scope boundary (what the frontend owns)

- All code under `frontend/` (React app, components, store, client, locales, tokens, SVG glyphs, landing media registry).
- The API client with mock mode (fixtures) and live mode, request-id staleness handling, and debounced slider input.
- i18n rendering (`t()`, `Intl` formatters, locale files, language switcher) — but not the message catalog itself, which the backend owns.
- Accessibility (keyboard, screen-reader directions list, aria-live, reduced motion, contrast, 200% zoom, 360 px width).
- Privacy UI and on-device UUID handling.
- The visual system (palette tokens, type, shape, map art, Sun mode).

### Non-goals (backend spec owns these)

- Routing, the heat/exposure/cost math, the frontier/scoring, safety-field computation, coverage/departure computation, the escalation reducer logic, the body-estimate model, and all thresholds/constants.
- `backend/contract/` (schemas, `messages.json`, fixtures). Only Person A edits this folder; the frontend consumes it.
- The data snapshot build and the HTTP server.

### Design-character principle (applies to every UI requirement)

"Olmsted field guide": warm paper, near-black ink, flat spot colours, hatching, numbered sections, hand-drawn SVG glyphs. Encode by **lightness, not hue**; redundant encoding (pattern + text + shape) so colour is never the sole signal. Hard bans: no emojis anywhere (UI, copy, code, commits), no gradients/glassmorphism/glow/neon/blurred blobs, no generic icon packs, no "AI-powered" copy, no Title Case Everywhere (sentence case), no grey-on-grey low-contrast text.

### Honesty principle

Modeled exposure and the estimated core temperature are shown as **modeled/illustrative**, never as measurements or medical advice. Simulated features carry a `SIMULATED` badge. Nothing re-routes the user without an explicit accept.

---

## Requirements

### R1 Application shell and routing

**User story:** As a user, I want distinct pages for the map, lab, watch, landing, privacy and about, so that I can reach each experience by URL.

#### R1 acceptance criteria

1. THE SYSTEM SHALL provide routes `/` (landing), `/app` (Navigator), `/lab` (Lab), `/watch` (Watch), plus Privacy and About pages reachable from the footer and settings sheet.
2. THE SYSTEM SHALL set `<html lang>` from the active locale and render one `h1` per page with headings in order.
3. THE SYSTEM SHALL support `?bare=1` on `/watch` to render the watch full-screen.
4. THE SYSTEM SHALL contain no domain logic or thresholds; all such values arrive from `/api/config`.

### R2 API client (mock and live)

**User story:** As Person B, I want a client that works on fixtures from hour 1 and flips to live at a checkpoint, so that frontend work never blocks on the backend.

#### R2 acceptance criteria

1. THE SYSTEM SHALL implement a client with a mock mode (serving `backend/contract/fixtures`) and a live mode (calling the API), switchable by config/env.
2. WHEN in mock mode THE SYSTEM SHALL show a `SAMPLE DATA` badge.
3. THE SYSTEM SHALL attach a request id to each call and drop stale responses (keep only the latest per logical request).
4. THE SYSTEM SHALL debounce slider input before issuing requests.
5. THE SYSTEM SHALL load bands, ramp steps, limits, speeds, event sizes, caps, and countdown length from `/api/config` and reference no hardcoded threshold.
6. WHEN the backend is unreachable THE SYSTEM SHALL show a notice and offer the clearly badged sample-data mode, never silently.
7. THE SYSTEM SHALL mock the escalation reducer by looking up `fixtures/escalation.json` by `(state.phase, event.type)` and the caution/critical thresholds from config, for the sample walkthrough only.

### R3 Visual system and tokens

**User story:** As a user in direct sun, I want a high-contrast printed-field-guide look, so that the screen stays readable under glare.

#### R3 acceptance criteria

1. THE SYSTEM SHALL define `@theme` tokens for paper, surface, ink, ink-2, necklace, amber, brick, charles, plum, sun, and use no colour outside the token set (enforced by a no-hex check).
2. THE SYSTEM SHALL keep all text at least 7:1 contrast against its background (WCAG AAA) and never use grey-on-grey.
3. THE SYSTEM SHALL use 1.5px ink borders, 10px radius, flat offset shadow `3px 3px 0 ink`, and the pressed state (shadow removed, 2px shift); no gradients, glow, blur, or soft shadows.
4. THE SYSTEM SHALL load Fraunces (display), Atkinson Hyperlegible Next (body/UI), Atkinson Hyperlegible Mono (numbers/labels) with a `system-ui` fallback, using tabular figures for changing numbers.
5. THE SYSTEM SHALL render badges in mono uppercase pill form: `LIVE` necklace, `SNAPSHOT` surface, `ESTIMATED` amber, `SIMULATED` plum (paper text).
6. THE SYSTEM SHALL use body 17px, key numbers 28-34px, UI weight >= 500, tap targets >= 48px, and place primary actions in the bottom thumb zone.
7. THE SYSTEM SHALL contain no emoji anywhere (UI, copy, code), enforced by `lint:content`.

### R4 Map and layers

**User story:** As a user, I want a calm Boston basemap with legible heat and resource layers, so that my own layers dominate.

#### R4 acceptance criteria

1. THE SYSTEM SHALL render a Boston map centred on Northeastern using CARTO Positron tiles at 70% opacity (50% in Sun mode).
2. THE SYSTEM SHALL draw routes with a 2px ink casing under a 7px colour line; alternatives in ink-2, dashed, 60% opacity.
3. THE SYSTEM SHALL colour route segments on the necklace -> amber -> brick ramp using thresholds from config, with a redundant paper tick pattern on high-heat segments and a legend reading "modeled exposure".
4. THE SYSTEM SHALL render in-house SVG `divIcon` glyphs with ink outlines for cooling center, drinking water, start, destination, walker, trees (zoom >= 16, grid-thinned, seeded rotation), parks (hatched), safety zones (cross-hatched, dashed), and a sun badge rotated to the azimuth with elevation in mono.
5. WHEN weather or time inputs change THE SYSTEM SHALL re-render layers without a page reload.
6. IF tiles fail THE SYSTEM SHALL still render graph-derived art on the paper background.
7. THE SYSTEM SHALL show per-layer provenance badges and a source line from `meta.json` (tap the badge stack for sources).

### R5 Navigator (`/app`)

**User story:** As a phone user, I want a bottom-sheet navigator, so that I can set a trip and compare routes with one thumb.

#### R5 acceptance criteria

1. THE SYSTEM SHALL render a top bar (logo, Sun mode toggle, tappable data-badge stack) and a full-screen map.
2. THE SYSTEM SHALL provide a bottom sheet with 3 snap points: peek (recommended time + heat-minutes + one-line explanation + Start), half (start/destination fields with presets and "tap map", mode segmented control, prior-exposure segmented control), full (route cards, explanation list, legend).
3. WHEN the user sets start and destination by map tap or preset THE SYSTEM SHALL request a plan and render ranked routes.
4. THE SYSTEM SHALL show per route: time, distance, heat-minutes, shade %, arrival exposure band, safety indicator, and nearby oasis count.
5. THE SYSTEM SHALL offer prior-exposure presets Fresh / 30 min / 60 min and mode Fastest safe / Balanced / Coolest, passing them to the plan request.
6. IF the plan returns no path THE SYSTEM SHALL show an inline notice and keep the previous state.
7. WHERE the viewport is desktop THE SYSTEM SHALL render the sheet as a 400px left panel.
8. THE SYSTEM SHALL render explanations from backend descriptors via `t(key, vars)`, never from hardcoded sentences.

### R6 Sun mode and mobile readability

**User story:** As a user outdoors, I want a sun mode and a layout that survives small screens, so that the app works in glare and on phones.

#### R6 acceptance criteria

1. THE SYSTEM SHALL provide a Sun mode toggle in the header and auto-suggest it when sun elevation exceeds the configured threshold.
2. WHEN Sun mode is on THE SYSTEM SHALL use a pure-white background, pure-black text, +2px strokes, 50% tiles, and promote secondary text to ink, keeping the same layout.
3. THE SYSTEM SHALL work at 360px width with no horizontal scroll and hold layout at 200% text size.

### R7 Lab (`/lab`)

**User story:** As a judge, I want a lab with scenario controls and playback, so that I can see the model respond and trigger each stage.

#### R7 acceptance criteria

1. THE SYSTEM SHALL provide controls for air temp, humidity, cloud cover, time of day, prior exposure, mode, safety weight, simulated HR, a live-weather toggle, and scenario presets.
2. THE SYSTEM SHALL animate a walker along the route geometry at x30/x60/x120, interpolating exposure from the response `aTrace` locally (never recomputing it).
3. WHEN an event occurs during playback (heat spike, HR spike, drop/remove safety zone, body-temp slider, any input change) THE SYSTEM SHALL call `/api/replan` with the walker position and present an **offer** only past the hysteresis margin or on a hard safety block, and SHALL NOT change the route without acceptance (except the default-off "simulate user accepts" toggle).
4. THE SYSTEM SHALL show an event log with trigger, decision, delta J, and reason.
5. THE SYSTEM SHALL show a live chart of accumulated exposure over walk time with band lines.
6. THE SYSTEM SHALL let the user drop and remove safety zones by tapping the map (zones labelled `SIMULATED`).
7. THE SYSTEM SHALL embed a scaled watch preview synced to the active route and playback.
8. WHERE the viewport is a phone THE SYSTEM SHALL collapse the three columns into tabs.

### R8 Watch (`/watch`)

**User story:** As a user, I want a watch view, so that glanceable guidance stays in sync with the route.

#### R8 acceptance criteria

1. THE SYSTEM SHALL render a 198x242 pt watch canvas inside a drawn bezel, on a black background with brightened tokens (necklace #4CC38A, amber #FFB020, brick #FF6A3D, charles #5AB8F0, text #FFFFFF).
2. THE SYSTEM SHALL provide a horizontal pager of views: Next move (turn glyph, 34pt mono distance, street name, next-300m exposure strip), Exposure ring (accumulated vs scale, band label "modeled", ETA), Nearest oasis (bearing arrow, distance, minutes, "status unknown" when applicable), Body (SIMULATED badge always visible, HR vs baseline).
3. THE SYSTEM SHALL navigate by Digital Crown (mouse wheel), arrow keys, swipe, and tap.
4. THE SYSTEM SHALL keep watch views in sync with the active route and Lab playback via the shared store.
5. WHEN a reroute or break advisory occurs THE SYSTEM SHALL show a full-screen alert overlay with Switch / Keep actions and a haptic-pattern label (using `navigator.vibrate` only on a phone).
6. WHEN `?bare=1` is set THE SYSTEM SHALL render the watch full-screen.
7. THE SYSTEM SHALL show mock complications (circular = exposure ring, rectangular = next turn + band) on the watch face.

### R9 Safety, offers, and escalation UI

**User story:** As a user, I want clear offers and an honest emergency flow, so that I stay informed and in control.

#### R9 acceptance criteria

1. THE SYSTEM SHALL render reroute/cooling/break advisories as offer cards (and watch overlays) with the cost/benefit, equal-weight Accept and Not now buttons (48px), a visible expiry, and no silent auto-dismiss; "Not now" snoozes that offer kind.
2. THE SYSTEM SHALL never change the route without an explicit accept (including safety detours), except the default-off Lab "simulate user accepts" toggle.
3. WHEN the body estimate reaches T1 THE SYSTEM SHALL show a dismissible amber caution banner (leaf-in-triangle glyph, text + pattern) that includes "Prototype. Not a medical device."
4. WHEN the body estimate reaches T2 THE SYSTEM SHALL show a full-screen critical dialog: paper background, brick top rule with tick pattern, a 64px Fraunces countdown number with a draining ring, "I am OK, cancel" as the largest control, and a secondary "Get help now".
5. THE SYSTEM SHALL count the countdown down locally from the `deadlineMs` returned by `/api/escalation/step`, so it completes even if the API becomes unavailable, and SHALL use real wall-clock time, not playback time.
6. IF the countdown ends without cancel THE SYSTEM SHALL show a simulated dispatch dialog with a permanent `SIMULATION: no call was placed` banner, listing exactly what would be shared (pseudonymous ID, modeled temperature with range, location), and SHALL make no network request.
7. THE SYSTEM SHALL honour prefers-reduced-motion in the critical dialog (number updates, ring does not animate).
8. THE SYSTEM SHALL show the estimate as "about 38.2 C (range 37.7 to 38.7), illustrative model" with a gauge-arc glyph, never a bare number, and never as a diagnosis.
9. THE SYSTEM SHALL provide a Lab simulated body-temperature slider that can trigger each stage.

### R10 Simulated wearable panel

**User story:** As a user, I want a clearly simulated wearable panel, so that it is never mistaken for a real device.

#### R10 acceptance criteria

1. THE SYSTEM SHALL render a wearable panel labelled `SIMULATED` showing HR vs baseline, with no diagnostic claims.
2. WHEN the simulated body-temperature reading exceeds the model's expected value by the margin, or HR exceeds baseline by the margin, THE SYSTEM SHALL surface the reroute/break offer returned by the backend.

### R11 Landing (`/`)

**User story:** As a visitor, I want a landing page that explains the product honestly, so that I understand the value and the limits.

#### R11 acceptance criteria

1. THE SYSTEM SHALL render a hero (logo, Fraunces headline, subline, CTAs "Open the map" and "Open the lab") and an SVG street-grid illustration.
2. THE SYSTEM SHALL render six numbered feature rows alternating text/media, a how-it-works (3 steps), a data-and-honesty section (badge legend + sources), a "Who it is for" section, a "Built with Kiro" section (spec, steering, hooks, CLI), the language switcher, and a footer.
3. THE SYSTEM SHALL drive media from `src/landing/media.ts` with a hatched placeholder and caption until a src (image or muted looping mp4) is set, and SHALL require `alt` (or a transcript/caption field) for every slot.

### R12 Internationalisation

**User story:** As a non-English speaker, I want the app in my language with correct formats, so that it is usable and legible.

#### R12 acceptance criteria

1. THE SYSTEM SHALL support en, es, it, zh-Hans, ja via one JSON file each in `src/locales/`, with adding a language requiring only a new file plus one registry entry in `src/i18n/locales.ts`.
2. THE SYSTEM SHALL contain no user-facing string literal in components; all text goes through `t('namespace.key', vars)`.
3. THE SYSTEM SHALL implement an in-house `t()` with `{var}` interpolation and plurals via `Intl.PluralRules` (`key_one`/`key_other`; ja and zh use `other` only).
4. THE SYSTEM SHALL format numbers, durations, temperature, distance, and time via `Intl`, with C/F and metric/imperial toggles.
5. THE SYSTEM SHALL provide a header language switcher using native names, detect from `navigator.language`, persist locally, and keep OSM street/place names as mapped.
6. THE SYSTEM SHALL use CJK font stacks (Noto Serif/Sans SC and JP) for zh and ja, disable uppercase/letter-spacing for them, use line-height 1.6, and hold every screen at Spanish length (about +30%), truncating only street names on the watch.
7. THE SYSTEM SHALL fail `npm run i18n:check` on missing, extra, or unused keys versus `en`, and SHALL verify every key in `backend/contract/messages.json` exists in `frontend/src/locales/en.json`.
8. THE SYSTEM SHALL own the frontend label keys `mode.*`, `preset.*`, `trip.*`.

### R13 Accessibility

**User story:** As a user with assistive technology, I want full keyboard and screen-reader support, so that every function is operable.

#### R13 acceptance criteria

1. THE SYSTEM SHALL target WCAG 2.2 AA (text at AAA) with semantic landmarks, ordered headings, and one `h1` per page.
2. THE SYSTEM SHALL render a screen-reader text-directions list for every selected route as the equivalent of the map.
3. THE SYSTEM SHALL make all functions keyboard-operable with a visible 3px focus ring, no keyboard traps, Leaflet keyboard enabled, and a searchable `places.json` destination list plus presets so start/destination are settable without the map.
4. THE SYSTEM SHALL use `aria-live="polite"` for route and offer updates and `assertive` for the critical dialog, announcing the countdown every 10 s.
5. THE SYSTEM SHALL honour prefers-reduced-motion (no walker tweening or pulsing; step updates only) and prefers-contrast: more (raise strokes and contrast, like Sun mode).
6. THE SYSTEM SHALL provide a step-free routing toggle that excludes stairs and wheelchair-unsuitable edges (passed to the plan request).
7. THE SYSTEM SHALL provide button equivalents for every gesture-only action and keep tap targets >= 48px.

### R14 Privacy UI

**User story:** As a user, I want on-device identity and clear disclosures, so that I control my data.

#### R14 acceptance criteria

1. THE SYSTEM SHALL create a random UUID v4 (`crypto.randomUUID()`) on first run, stored locally (localStorage with an in-memory fallback), with no account or personal data.
2. THE SYSTEM SHALL keep settings and the UUID on device and send the UUID to the backend only inside the simulated dispatch preview, which makes no request.
3. THE SYSTEM SHALL provide a Privacy page listing what is stored and what is sent (routing coordinates to the backend; tiles to CARTO; optional Open-Meteo with coordinates rounded to 2 decimals and no UUID), with "Reset ID and delete my data" and "Export my data" (JSON) actions.
4. THE SYSTEM SHALL gate first run with a translated consent card describing what stays on device, what the backend sees, the simulated wearable, and the simulated emergency, and SHALL make no analytics or tracking calls.

### R15 Resilience and honesty

**User story:** As a user, I want graceful fallbacks and honest labels, so that the app stays usable and never overclaims.

#### R15 acceptance criteria

1. IF live weather fails THE SYSTEM SHALL fall back to the Heatwave preset and say so via a notice.
2. IF a snapshot or layer load fails THE SYSTEM SHALL show a full-screen notice with retry and keep prior state where possible.
3. THE SYSTEM SHALL show every layer's provenance badge and source line, and label all modeled/simulated features (modeled exposure, illustrative estimate, SIMULATED zones/wearable/dispatch).

### R16 Content safety

**User story:** As any user, I want copy and imagery that cause no accidental offence, so that the product is respectful everywhere.

#### R16 acceptance criteria

1. THE SYSTEM SHALL present safety zones as generic `SIMULATED` "caution areas", never named after real neighbourhoods and never described as crime.
2. THE SYSTEM SHALL contain no emojis and none of the denylisted terms (jokes about bodies/age/disability/weight/illness, gendered or ableist idioms), enforced by `lint:content` plus a human pass across the five languages.
3. THE SYSTEM SHALL keep icons free of hand gestures, flags, and religious/ethnic imagery, keep the walker glyph abstract, use no third-party brand marks ("watch"/"wearable" only), and use demo names that are places, not people.
4. THE SYSTEM SHALL never let colour be the sole signal (always pair with pattern and text label).

### R17 Departure, coverage, and offline (T2/T3)

**User story:** As a user, I want to see the best time to walk and area coverage, and an offline shell, so that the app is useful beyond a single route.

#### R17 acceptance criteria

1. THE SYSTEM SHALL render best-route modeled heat vs departure time across the day and the best departure window (from `/api/departure`) in a Lab "Leave when" tab. **[T2]**
2. THE SYSTEM SHALL render walking minutes to the nearest oasis and the share of streets within 5 and 10 minutes, plus the suggested top-k sites labelled as a heuristic (from `/api/coverage`) in a Lab "Coverage" tab. **[T2]**
3. THE SYSTEM SHALL install as a PWA that opens offline and states that routing needs a connection (app-shell caching only). **[T3]**

### R18 Kiro evidence (frontend share)

**User story:** As a reviewer, I want frontend Kiro artifacts, so that the workflow is evidenced.

#### R18 acceptance criteria

1. THE SYSTEM SHALL include the frontend portion of the "Built with Kiro" landing section and frontend `KIRO_LOG.md` lines, with the three always-on steering files (UI, i18n/accessibility, safety/privacy/content) governing frontend work.
