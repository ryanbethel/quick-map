# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this project is

`quick-map` is a demo of a **vanilla, progressively enhanced web component** for displaying USGS topographic maps. It is built with **Enhance** (HTML-first, server-rendered Custom Elements) on top of **Architect** (functions-on-AWS-Lambda).

The map is rendered on the server as a plain `<img>` grid of USGS map tiles. JavaScript on the client is optional and only layered on top to add interactivity (geolocation, drag-to-pan, etc.). The page must work with JS disabled.

## Core principles (do not violate without asking)

1. **HTML-first.** Every feature must work as plain HTML/forms first. JS only enhances.
2. **Vanilla web components only.** The only web-component framework allowed in this project is **Enhance** (server-side). On the client, use the native Custom Elements API and DOM APIs directly — nothing else. Do not add Lit, Stencil, FAST, Hybrids, Atomico, Solid Element, Preact, Alpine, htmx, or any other component / reactivity / templating library. No exceptions; if you think one is needed, stop and ask.
3. **No heavy mapping libraries.** Do **not** add Leaflet, MapLibre, Mapbox GL, OpenLayers, Google Maps SDK, Cesium, deck.gl, or similar. The whole point is a minimal hand-rolled tile renderer.
4. **Minimize dependencies.** Before adding any npm package, ask: can this be ~50 lines of vanilla JS? If yes, write it. Prefer the platform.
5. **Progressive enhancement order:** server-rendered HTML → form-based interaction → tiny enhancement script that hijacks the form / adds DOM behavior. Never invert this.
6. **Standalone Enhance + Architect.** Begin.com (the hosted platform) is deprecated. Do not use the `begin` CLI, `begin dev`, `@begin appID` in `.arc`, or any other Begin-platform-specific config. Use `@enhance/cli`, `@enhance/arc-plugin-enhance`, and `@architect/architect` directly. **Exception:** `@begin/data` is fine to keep — it is a small, stable wrapper around DynamoDB and is independent of the Begin platform.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | [Enhance](https://enhance.dev) — server-rendered Custom Elements + file-based routing |
| Hosting / dev server | [Architect](https://arc.codes) (`arc sandbox`, `arc deploy`) |
| Plugin | `@enhance/arc-plugin-enhance` (latest, currently v11.x) |
| Styles | `@enhance/arc-plugin-styles` (replaces deprecated `@enhance/styles-cribsheet`) |
| Tile source | USGS National Map: `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}` |
| Geocoding | Nominatim (OpenStreetMap) |
| Routing (directions) | Public Valhalla (`valhalla1.openstreetmap.de`). Use `fetch`; do not add `@routingjs/*`. |
| Runtime | Node.js (Lambda), ESM only (`.mjs`) |

## Project layout

```
app/
  api/        Data routes (return { json, session, location, status })
  pages/      HTML / template routes (consume state.store from matching api/ route)
  elements/   Server-rendered Custom Elements (pure functions: ({html, state}) => html`...`)
  components/ (preferred for new work) Single-file web components — server template + class
  browser/    Optional client-side enhancement scripts
  head.mjs    <head> template
.arc          Architect manifest (app name, plugins, tables, runtime)
public/       Static assets
```

File-based routing maps `app/api/zoom/$zoom/lat/$latitude/lon/$longitude.mjs` to `GET /zoom/:zoom/lat/:latitude/lon/:longitude`. The matching `app/pages/...` file receives the API's `json` as `state.store`.

## Current state and known issues

The repo has not been touched in a while. Treat the following as work to be done, not as a working baseline:

- `package.json` still references begin-era versions (`@enhance/arc-plugin-enhance` ^6.2.0, `@enhance/cli` ^1.0.3, `@enhance/styles-cribsheet`). These need to be upgraded to current Enhance.
- `package.json` still has `"start": "begin dev"`. Replace with Architect: `"start": "arc sandbox"`.
- `.arc` references `@begin appID S9MG8RGW` and `enhance/styles-cribsheet`. Drop the `@begin` block; replace `styles-cribsheet` with `@enhance/arc-plugin-styles`.
- `app/head.mjs` imports from `@enhance/arc-plugin-styles` but the project depends on `@enhance/styles-cribsheet` — mismatch.
- `app/api/zoom/$zoom/zip/$zipcode.mjs` imports `@begin/data` but it isn't listed in `package.json`. Add it as an explicit dependency. (`@begin/data` itself is fine — it's a stable, minimal DynamoDB wrapper, not part of the deprecated Begin platform.)
- `app/api/findroute.mjs` is broken (syntax errors, undefined vars). Either fix it or delete it — it appears unused (`/directions` is the live route).
- `@routingjs/valhalla` is a heavyweight dep that isn't used. Remove it; the existing `fetch` call to Valhalla is enough.
- Map tile / lat-lon math is duplicated across `api/zoom/.../$longitude.mjs`, `api/zoom/.../$zipcode.mjs`, and `api/route.mjs`. Extract to a shared module (e.g. `app/api/_lib/tiles.mjs`).
- The "map" is currently spread across a page template plus several elements. Roadmap: consolidate into a single `<usgs-map>` web component (see below).

## The big goal: `<usgs-map>` web component

Refactor the map into one reusable, progressively enhanced web component:

```html
<usgs-map lat="43.68" lon="-70.25" zoom="14"></usgs-map>
```

Behavior:

- **Server-rendered (no JS):** the element's children are the 5×5 `<img>` grid of USGS tiles, the marker SVG, scale bar, and `<form>`-based controls (zoom in/out, address, geolocation). Everything navigates via plain links/forms.
- **Enhanced (with JS):** the same element registers a Custom Element class that:
  - Hijacks the zoom and geolocation forms to update tiles in place via `fetch` + DOM swap instead of full navigation.
  - Adds drag-to-pan, double-click-to-zoom-and-center, long-press to drop a marker.
  - Exposes attributes (`lat`, `lon`, `zoom`) and emits events (`map:move`, `map:zoom`, `map:select`).
- It must remain fully functional if the JS fails to load.

Build it as a single-file web component in `app/components/usgs-map.mjs` so the server template and client class live together.

## Roadmap (from the original `readme.md`, restated)

- [ ] Double-click to zoom and center (client enhancement)
- [ ] Long-press to drop a marker (client enhancement)
- [ ] Click-and-drag to pan (client enhancement)
- [ ] Run map clientside as a PE on top of the SSR grid
- [ ] Proxy USGS tiles through our own route (caching, offline)
- [ ] Service worker for offline tile caching
- [ ] Pre-download multiple zoom levels
- [ ] Periodic location updates

## Conventions

- ES modules only, `.mjs`.
- 2-space indent, semicolon-optional but stay consistent with the file you're editing.
- Server templates use the tagged-template `html\`\`` from Enhance — return a string; do not produce DOM on the server.
- Inline `<style>` inside elements/components is fine (Enhance scopes them). Avoid global stylesheets except for `body` resets.
- Keep client `<script type="module">` blocks small. If a script grows past ~50 lines, move it to `app/browser/` and import it.
- Don't define a Custom Element more than once; guard with `if (!customElements.get('foo')) customElements.define(...)`.
- API handlers return `{ json, session, location, status }`. Keep them small and side-effect-free where possible.
- Don't write narration comments. Comments should explain *why*, not *what*.

## Commands

```bash
npm install
npm start          # arc sandbox — local dev (after migration)
npm run lint       # eslint --fix on app/**/*.mjs
arc deploy         # deploy to AWS (after migration; requires AWS creds)
```

## When in doubt

- Prefer deleting code over adding code.
- Prefer a `<form>` over a click handler.
- Prefer a `<a href>` over `pushState`.
- Prefer an `<img>` over a canvas.
- Ask before adding a dependency.
