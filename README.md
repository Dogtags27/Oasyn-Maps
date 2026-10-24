# Oasyn Maps

Heat-aware navigation for a hotter world.

Oasyn Maps helps people navigate hot, sunny cities by finding walking routes with less sun exposure, nearby shade, and access to cooling resources.

## Built with Kiro

Oasyn Maps was built with Kiro using spec-driven development. See `.kiro/specs/`
for the backend and frontend specifications.

The **backend** (`backend/`) — the deterministic routing engine, environment and
exposure models, data snapshot pipeline, and HTTP API — was built end to end with
Kiro: steering scoped to the engine (`.kiro/steering/backend-core.md`), agent
hooks (core tests on save, descriptor-parity check), an hour-by-hour build log
(`backend/KIRO_LOG.md`), and the spec it was built against
(`.kiro/specs/oasyn-backend`). The graph snapshot (Greater Boston inner metro) is
built from OpenStreetMap via Overpass, published to Cloudflare R2, and loaded as a
compact binary CSR at startup.
