# `<usgs-map>`

Server-rendered USGS topo map. Drop it in any container — page, iframe, or fixed-size div. Works without JS; the inline script enhances it with drag, pinch, dblclick, dialog-based pin add, and a `ResizeObserver` that re-fits the tile grid when the container changes size.

## Quick start

```html
<usgs-map lat="43.68" lon="-70.25" zoom="11"></usgs-map>
```

In a fixed container:

```html
<div style="width: 480px; height: 320px;">
  <usgs-map lat="43.68" lon="-70.25" zoom="11"></usgs-map>
</div>
```

The element fills its parent (`width: 100%; height: 100%`). For a full-page render, the document needs an unbroken height chain: `html, body { height: 100% }`. **Size the parent, not the map** — `<usgs-map width="…" height="…">` attributes are no-ops; they used to be implemented via `:host { width: …; height: … }` baked per-instance into the global stylesheet, which collides between instances under Enhance's flat-DOM SSR. See ["Authoring constraint"](#authoring-constraint) below.

## Composition

```html
<usgs-map lat="43.68" lon="-70.25" zoom="11">
  <map-pin lat="43.68" lon="-70.25" name="Portland"></map-pin>
  <map-pin lat="44.31" lon="-69.78" name="Augusta"></map-pin>
</usgs-map>
```

Each chrome piece is independently toggleable. Hide everything except tiles + pins:

```html
<usgs-map controls="none" info="none" crosshair="false" scale="false" lat="43.68" lon="-70.25" zoom="11">
  <map-pin lat="43.68" lon="-70.25"></map-pin>
</usgs-map>
```

For a fully static, no-gesture preview (e.g. a thumbnail) use `chrome="minimal"` (or the `<map-thumbnail>` element):

```html
<usgs-map chrome="minimal" lat="43.68" lon="-70.25" zoom="11"></usgs-map>
```

Place your own controls anywhere; they wire to the map by id:

```html
<usgs-map id="my-map" controls="none" info="none" lat="43.68" lon="-70.25" zoom="11">
  <map-pin lat="43.68" lon="-70.25"></map-pin>
</usgs-map>
<map-nav for="my-map"></map-nav>
<map-scale zoom="11" lat="43.68"></map-scale>
```

## Attributes

| attr               | type             | default | notes |
| ------------------ | ---------------- | ------- | ----- |
| `lat`              | number           | —       | Initial center latitude. Attrs win; falls back to `state.store.centerLat`. |
| `lon`              | number           | —       | Initial center longitude. Attrs win; falls back to `state.store.centerLon`. |
| `zoom`             | int              | 10      | Web-Mercator zoom (0–16). Attrs win; falls back to `state.store.zoom`. |
| `cols`             | int 3–13         | 7       | Tile-grid cols. Attrs win; falls back to `state.store.gridCols`. |
| `rows`             | int 3–13         | 7       | Tile-grid rows. Attrs win; falls back to `state.store.gridRows`. |
| `width`            | —                | —       | **Removed.** Size the parent container instead. |
| `height`           | —                | —       | **Removed.** Size the parent container instead. |
| `controls`         | `full` / `none`  | `full`  | Show/hide the built-in nav buttons. **Gestures (drag/pinch/dblclick) still work** when `none`. |
| `info`             | `full` / `none`  | `full`  | Show/hide the bottom-left info / creator panel. |
| `crosshair`        | `true` / `false` | `true`  | Show/hide the center crosshair dot. |
| `scale`            | `true` / `false` | `true`  | Show/hide the bottom-right scale label. |
| `chrome`           | `minimal`        | —       | Hides ALL chrome AND disables gestures. The "static preview" mode used by `<map-thumbnail>`. |
| `click-to-pick`    | `true` / `false` | `false` | Single-click on the map (no drag) recenters via `setView` AND emits `map:select { lat, lon }`. The crosshair stays at the geometric center, so it visually jumps to the click. Use it for picker UIs. Has no effect in `mode="create"` (create's click already opens the add-pin dialog). |
| `base-url`         | URL              | (auto)  | Where the no-JS forms post. Defaults to `/c/{id}` (view) or `/c/new` (create). |
| `no-script`        | (boolean)        | —       | Per-instance opt-out: suppress the inline `<script>` at SSR time AND bail out of `connectedCallback` at runtime, so this instance attaches no listeners, no `ResizeObserver`, and never navigates. Required when mixing static maps (`<map-thumbnail>`, etc.) with active maps on the same page — without it, an SSR-deduped class definition from the active map will upgrade the static map and the resize-driven `refit()` will infinite-loop via `window.location.assign()`. |
| `polyline`         | encoded string   | —       | A Google/Valhalla encoded polyline. Drawn as a route overlay on top of tiles. |
| `polyline-precision` | int            | `6`     | Polyline precision: `5` for OSRM, `6` for Valhalla. |
| `render`           | `client`         | —       | Opt-in. SSR is unchanged; when JS mounts, every gesture rebuilds the tile grid, polyline overlay, and `<map-pin>` positions in place via DOM (no full-page nav). The URL still updates via `history.replaceState` so reload / share / bookmark work. No-JS users get today's SSR-only behavior. See "Render modes" below. |

For long polylines, pass already-decoded `[ [lat, lon], … ]` coordinates via `state.store.polylineCoordinates` (avoids URL-length limits and re-decoding).

Hide-values for the boolean-style attrs: any of `none`, `false`, `0`, `hide`, `off` (case-insensitive). Anything else (including the attribute being absent) means "show".

For full collection-editor use, the API handler additionally publishes `state.store` keys like `collectionMode`, `collectionId`, `collectionTitle`, `draftPinCount`, `fit`, `flash`, `viewW`, `viewH`. See [app/api/c/$id.mjs](../api/c/$id.mjs) and [app/api/c/new.mjs](../api/c/new.mjs).

## Imperative API (when JS is on)

```js
const map = document.getElementById('my-map')
map.zoomIn()
map.zoomOut()
map.panBy(dx, dy)            // pixels; one tile = 256 px
map.setView({ lat, lon, zoom })
map.fitPins()                // refits the bbox using the container size
```

These are the methods slotted/sibling controls (`<map-nav>`, `<address-search>`) call. You can call them directly too.

## Events

| event         | detail               |
| ------------- | -------------------- |
| `map:move`    | `{ lat, lon, zoom }` |
| `map:select`  | `{ lat, lon }`        |

## State sharing

`<usgs-map>` listens for `submit` events bubbling from any descendant form that has `data-nav-action` or `data-action` (the convention used by `<map-nav>` and the built-in chrome). When JS is on it intercepts these and calls the imperative API in-place. With JS off, the same forms navigate via the URL contract.

It also listens for `geocode:result` events from `<address-search>` and calls `setView` automatically.

## Render modes

| mode | how gestures update the map |
| --- | --- |
| **default** | Every gesture (drag, pinch, dblclick, button, address search, resize) writes the new view into the URL and reloads the page. The server re-renders SSR HTML; the browser fetches new tile images. Reliable, fully PE-compatible, but each interaction triggers a full nav. |
| **`render="client"`** | Same SSR for the first paint. Once JS mounts, every gesture is handled in-place: `buildTileGrid()` runs in the browser, the `.map-grid` children are reconciled (existing tiles whose URL still matches are kept, others are swapped), `<map-pin>` slotted children are repositioned via `latLonToGridPixel`, and the polyline overlay is redrawn per-tile. The URL is still updated via `history.replaceState({}, '', ...)` so reload, share, and back/forward all work. Tile images are still fetched directly from `basemap.nationalmap.gov` — no proxy. |

The math is shared between both modes: `app/browser/tiles.mjs` is used both server-side (imported relative to the element file) and client-side (Enhance bundles it to `/_public/browser/tiles.mjs`, the inline script imports from there).

## URL contract (no-JS baseline)

Every gesture / form submission lands at `?lat=…&lon=…&zoom=…&cols=…&rows=…&w=…&h=…`. The handler must accept these. Additionally, when the client triggers a refit due to a container size change, it sends `?fit=1` *without* lat/lon/zoom — the server should respond with bbox-fit center+zoom recomputed against `w`/`h`.

- `view` mode posts to `/c/{collectionId}`.
- `create` mode posts to `/c/new`.

### URL-ownership guard

Navigation (gestures, `ResizeObserver` refit, imperative `setView` / `zoomIn` / `panBy` / `fitPins`) only fires when `base-url` matches `window.location.pathname`. If the map is embedded on a host page that owns a different URL — say a kitchen-sink page hosting `<usgs-map base-url="/demo/embed">` — the client will *not* call `window.location.assign()` (which would otherwise reload the host and, with `ResizeObserver`, infinite-loop). For interactive embeds, put the map in an `<iframe src="/its-own-url">` so it owns the URL inside the frame. For static previews, use `chrome="minimal"` or `<map-thumbnail>`. `map:move` events still fire so consumers can react however they like.

## Endpoints `<usgs-map>` and `<map-pin>` POST to (create mode)

| method/url           | from                   | body                       |
| -------------------- | ---------------------- | -------------------------- |
| `POST /c/new/add`    | dialog or panel form   | `lat`, `lon`, `zoom`, `name`, `note` |
| `POST /c/new/remove` | pin popover            | `index`                    |
| `POST /c/new/clear`  | panel                  | (none)                     |
| `POST /c`            | save panel             | `title`                    |

## Embedding in an iframe

```html
<a href="/c/abc?lat=43.68&lon=-70.25&zoom=11" target="map">Portland</a>

<form action="/c/abc" method="GET" target="map">
  <input name="lat"><input name="lon"><input name="zoom" value="13">
  <button>Go</button>
</form>

<iframe name="map" src="/c/abc"></iframe>
```

Working example: [app/pages/embed/$id.mjs](../pages/embed/$id.mjs) (route: `/embed/:id`).

## Theming

| variable                           | default                       |
| ---------------------------------- | ----------------------------- |
| `--usgs-map-bg`                    | `#e8e8e8`                     |
| `--usgs-map-fg`                    | `#111111`                     |
| `--usgs-map-min-height`            | `0`                           |
| `--usgs-map-crosshair`             | `rgba(0,0,0,0.55)`            |
| `--usgs-map-panel-bg/border/shadow`| `rgba(255,255,255,0.95)` etc. |
| `--usgs-map-button-bg/fg/border`   | `#ffffff` / `#111111` / `#cccccc` |
| `--usgs-map-button-hover-bg`       | `#f2f2f2`                     |
| `--usgs-map-primary-bg/fg`         | `#0066ff` / `#ffffff`         |
| `--usgs-map-flash-bg/fg/border`    | `#ffe9c2` / `#5b3a00` / `#d4a64a` |
| `--usgs-map-muted`                 | `#444444`                     |

Slotted children (`<map-pin>`, `<map-nav>`, `<map-scale>`) have their own variables — see their docs.

## Authoring constraint

hf-maps' SSR runs in **flat-DOM (no Shadow DOM)** under Enhance. The `:host` selector in `<style>` blocks is rewritten to the tag-name selector and emitted into a single global stylesheet that's deduped by exact text match. That means **any per-instance value interpolated into a `<style>` block leaks across every instance of the same element on the page** — the last one parsed wins under the cascade.

In practice that bit us with two patterns: per-instance host sizing (`<usgs-map width="200">` overriding the next instance), and per-instance `.map-grid-wrap` / `.map-grid` dimensions varying with `cols`/`rows`. To avoid the trap going forward, hf-maps elements follow this rule:

1. **Static rules** live in `<style scope="global">` with explicit element-name selectors (no `:host`). Enhance dedupes them once across all instances.
2. **Per-instance values** (sizes, transforms, anything that varies with attrs) ride on the matching element's inline `style` attribute and never enter the stylesheet.
3. **Sizing the host** (when needed) is the consumer's responsibility — wrap the element with a sized container, or use a preset wrapper like `<map-thumbnail>` that internally renders an inline-styled box.

When authoring a new template, treat anything you'd interpolate into CSS as a smell: move it to `style="…"` on the rendered element instead.

## Client behavior summary

- 1 pointer → drag-to-pan; release snaps to nearest tile boundary then navigates.
- 2 pointers → pinch; release zooms ±1 if scale crosses 1.5× / 0.67×, anchored at midpoint.
- Mouse `dblclick` (view mode only) → zoom +1 centered on click.
- Click on map (create mode only) → opens `<dialog>` with lat/lon pre-filled.
- One `<map-pin>` `<details>` open at a time; Esc and outside-click close.
- `ResizeObserver` watches the host element. First non-zero observation re-navigates to `?fit=1&w&h&cols&rows` if the SSR grid doesn't match the container; subsequent resizes do the same, debounced (paused while dragging, pinching, dialog open, or input focused).
