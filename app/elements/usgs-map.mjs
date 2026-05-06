// <usgs-map> — server-rendered, host-sized USGS topo map.
//
// Reads its config from `state.store` so any page hosting it can hydrate it,
// or from attrs as a fallback so it can be dropped in without an API handler:
//
//   centerLat / lat        : number    - current view center
//   centerLon / lon        : number    - current view center
//   zoom                   : int 0-16  - integer Web-Mercator zoom
//   gridCols / cols        : int 3-13  - tile grid size (default 7×7)
//   gridRows / rows        : int 3-13
//   collectionMode         : "view" | "create"   (default "view")
//   collectionId           : string    - used to build form actions in view mode
//   collectionTitle        : string    - optional, rendered in the info panel
//   draftPinCount          : int       - in create mode, current draft length
//   flash                  : string    - optional flash banner
//   chrome                 : "minimal" - "preview" mode: hides ALL chrome
//                                        (controls, info, crosshair, scale),
//                                        disables gestures, and centers the
//                                        lat/lon point at the visual center.
//   controls               : "full" | "none"  - default "full". Show/hide the
//                                        built-in nav buttons. Gestures are
//                                        unaffected (drag/pinch/dblclick still
//                                        work) — use `chrome="minimal"` for
//                                        a fully static preview.
//   info                   : "full" | "none"  - default "full". Show/hide the
//                                        info / creator panel.
//   crosshair              : "false"          - hide the center crosshair.
//   scale                  : "false"          - hide the bottom-right scale.
//   width / height         : css size  - explicit override; otherwise the
//                                        host element fills its parent
//   base-url               : URL       - where forms submit (defaults to the
//                                        collection-id-derived URL or current pathname)
//   no-script              : boolean   - skip the inline <script>; emits a
//                                        purely static, no-JS map
//
// Slotted children:
//   default slot           - <map-pin> elements (and any custom overlays)
//   <map-nav>, <address-search>, etc. — submit events bubble to the map and
//   are intercepted to drive the imperative API in-place when JS is on.
//
// Imperative API (when JS is on):
//   zoomIn(), zoomOut(), panBy(dx, dy), setView({ lat, lon, zoom }), fitPins()
//
// Events:
//   map:move  { lat, lon, zoom }   - emitted on every navigation
//   map:zoom  { zoom }
//   map:select { lat, lon }        - dblclick / click-to-add

import { buildTileGrid, decodePolyline, pixelToLatLon } from '../browser/tiles.mjs'

const FULL_TILE = 256

// Where the inline browser script imports the shared math from. Enhance's
// arc-plugin-rollup bundles `app/browser/tiles.mjs` to `public/browser/tiles.mjs`,
// which the static catchall serves at `/_public/browser/tiles.mjs`. In production
// the path is fingerprinted automatically by the framework.
const TILES_LIB_URL = '/_public/browser/tiles.mjs'

export default function usgsMap ({ html, state }) {
  const store = state?.store || {}
  const attrs = state?.attrs || {}

  const centerLat = parseFloat(store.centerLat ?? attrs.lat)
  const centerLon = parseFloat(store.centerLon ?? attrs.lon)
  const zoomRaw = parseInt(store.zoom ?? attrs.zoom, 10)
  const zoom = Number.isFinite(zoomRaw) ? Math.max(0, Math.min(16, zoomRaw)) : 10
  const mode = (store.collectionMode || attrs.mode) === 'create' ? 'create' : 'view'
  const collectionId = store.collectionId || attrs['collection-id'] || ''
  const title = store.collectionTitle || attrs.title || ''
  const draftPinCount = Number.isFinite(parseInt(store.draftPinCount, 10))
    ? parseInt(store.draftPinCount, 10) : 0
  const flash = store.flash || ''
  const minimal = store.chrome === 'minimal' || attrs.chrome === 'minimal'
  // Granular toggles. Each defaults to "show"; honored only when not minimal
  // (minimal blanks everything for preview/static use). String "none" or
  // "false" hides; anything else (incl. missing attr) shows.
  const showControls = !minimal && !isHidden(attrs.controls ?? store.controls)
  const showInfo = !minimal && !isHidden(attrs.info ?? store.info)
  const showCrosshair = !minimal && !isHidden(attrs.crosshair ?? store.crosshair)
  const showScale = !minimal && !isHidden(attrs.scale ?? store.scale)
  const noScript = attrs['no-script'] != null
  // Opt-in client-side rendering: SSR is unchanged, but once JS mounts the
  // map rebuilds the tile grid, polyline overlay, and pin positions in place
  // on every gesture instead of full-page navigating. Pure enhancement layer
  // — no-JS users still get today's behavior.
  const clientRender = (attrs.render ?? store.render) === 'client'
  const polylineEncoded = typeof attrs.polyline === 'string' ? attrs.polyline : ''
  const polylinePrecisionAttr = parseInt(attrs['polyline-precision'], 10)
  const widthAttr = sizeAttr(attrs.width)
  const heightAttr = sizeAttr(attrs.height)
  const baseUrlAttr = attrs['base-url'] || ''

  const gridCols = clampGrid(parseInt(store.gridCols ?? attrs.cols, 10), 7)
  const gridRows = clampGrid(parseInt(store.gridRows ?? attrs.rows, 10), 7)
  const viewW = Number.isFinite(parseInt(store.viewW, 10)) ? parseInt(store.viewW, 10) : null
  const viewH = Number.isFinite(parseInt(store.viewH, 10)) ? parseInt(store.viewH, 10) : null
  const fit = store.fit && Number.isFinite(parseFloat(store.fit.centerLat))
    ? {
      lat: parseFloat(store.fit.centerLat),
      lon: parseFloat(store.fit.centerLon),
      zoom: parseInt(store.fit.zoom, 10)
    }
    : null

  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) {
    return html`<p class="map-error">Map cannot render: center coordinates missing.</p>`
  }

  // Polyline can come from the store as an already-decoded array, or from an
  // `polyline` attribute as an encoded Google/Valhalla string. Precision
  // defaults to 6 (Valhalla); pass `polyline-precision="5"` for OSRM.
  const polylineCoordinates = resolvePolyline(store, attrs)

  const grid = buildTileGrid({
    latitude: centerLat,
    longitude: centerLon,
    zoom,
    rows: gridRows,
    cols: gridCols,
    polylineCoordinates
  })

  // Form action URL: explicit `base-url` attr wins; otherwise build from
  // the collection mode/id. The client preserves the current pathname when
  // building post-gesture URLs, so this only matters for the no-JS forms.
  const baseUrl = baseUrlAttr || (mode === 'create'
    ? '/c/new'
    : (collectionId ? `/c/${encodeURIComponent(collectionId)}` : ''))

  // Stage center = geometric center of the wrap = where the crosshair sits in
  // screen space.
  const stageCenterX = (gridCols * 256) / 2
  const stageCenterY = (gridRows * 256) / 2

  // The lat/lon center's natural position inside the wrap is
  // (centerCol*256 + offset.x, centerRow*256 + offset.y), which can be up to
  // 128 px off the wrap's geometric center depending on where the center
  // happens to fall inside its tile. Translate the wrap so that point lands
  // exactly at the stage center (= the crosshair). Doing this on every
  // render means a free-pan drag can compute the post-release lat/lon from
  // the *full* drag distance (not snapped to the nearest tile boundary) and
  // the next SSR will pick a matching shift — no visual jump.
  const centerCol = Math.floor((gridCols - 1) / 2)
  const centerRow = Math.floor((gridRows - 1) / 2)
  const crossX = centerCol * 256 + grid.offset.x
  const crossY = centerRow * 256 + grid.offset.y
  const wrapShiftX = Math.round(stageCenterX - crossX)
  const wrapShiftY = Math.round(stageCenterY - crossY)

  // Pan / nudge buttons shift the view by `(dx, dy)` screen pixels relative
  // to the crosshair, so use the crosshair's wrap-local position as the
  // anchor. Using the wrap's geometric center instead would introduce up to
  // a 128 px error per click when the center sits off-tile-grid.
  const nudgeFields = (dx, dy) => {
    const { lat, lon } = pixelToLatLon(crossX + dx, crossY + dy, zoom, centerLat, centerLon, gridCols, gridRows)
    return navFields(lat.toFixed(6), lon.toFixed(6), zoom, gridCols, gridRows, viewW, viewH)
  }

  const zoomInFields = navFields(centerLat, centerLon, Math.min(zoom + 1, 16), gridCols, gridRows, viewW, viewH)
  const zoomOutFields = navFields(centerLat, centerLon, Math.max(zoom - 1, 0), gridCols, gridRows, viewW, viewH)

  const hostStyle = `${widthAttr ? `width: ${widthAttr};` : ''}${heightAttr ? `height: ${heightAttr};` : ''}`

  return html`
<style>
  :host {
    display: block;
    position: relative;
    width: ${widthAttr || '100%'};
    height: ${heightAttr || '100%'};
    min-height: var(--usgs-map-min-height, 0);
    overflow: hidden;
    background-color: var(--usgs-map-bg, #e8e8e8);
    color: var(--usgs-map-fg, #111111);
  }

  .map-stage {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map-grid-wrap {
    position: relative;
    width: ${gridCols * 256}px;
    height: ${gridRows * 256}px;
    /* Don't let the flex parent (.map-stage) shrink the wrap. With absolutely
       positioned children, min-width: auto resolves near 0 and the flex
       algorithm collapses the wrap to the stage width — combined with the
       transform: translate(...) used in chrome="minimal" mode, that leaves
       a strip of host bg showing on one side. */
    flex-shrink: 0;
    flex-grow: 0;
    touch-action: none;
    cursor: grab;
  }

  .map-grid-wrap[data-mode="create"] {
    cursor: crosshair;
  }

  .map-grid-wrap.dragging,
  .map-grid-wrap[data-mode="create"].dragging {
    cursor: grabbing;
    will-change: transform;
  }

  .map-grid-wrap.snapping {
    transition: transform 130ms ease-out;
  }

  .map-grid-wrap.pinching {
    will-change: transform;
  }

  .map-grid {
    display: grid;
    grid-template-columns: repeat(${gridCols}, 256px);
    grid-template-rows: repeat(${gridRows}, 256px);
    gap: 0;
    position: absolute;
    inset: 0;
  }

  .tile-container {
    position: relative;
    width: 256px;
    height: 256px;
  }

  img.map-tile {
    width: 256px;
    height: 256px;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
  }

  .tile-container svg.route-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .center-crosshair {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 18px;
    height: 18px;
    margin-left: -9px;
    margin-top: -9px;
    border: 2px solid var(--usgs-map-crosshair, rgba(0, 0, 0, 0.55));
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
    pointer-events: none;
    z-index: 25;
  }

  .map-scale-default {
    position: absolute;
    bottom: 12px;
    right: 12px;
    color: var(--usgs-map-fg, #111111);
    z-index: 5;
  }

  .panel {
    position: absolute;
    background-color: var(--usgs-map-panel-bg, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--usgs-map-panel-border, #cccccc);
    border-radius: 8px;
    box-shadow: var(--usgs-map-panel-shadow, 0 1px 4px rgba(0, 0, 0, 0.2));
    color: var(--usgs-map-fg, #111111);
    box-sizing: border-box;
  }

  .controls {
    top: 12px;
    right: 12px;
    padding: 6px;
    display: grid;
    grid-template-columns: 36px 36px 36px;
    grid-template-rows: 36px 36px 36px 36px;
    gap: 4px;
    align-items: center;
    justify-items: center;
  }

  .controls form {
    margin: 0;
  }

  .controls button {
    width: 36px;
    height: 36px;
    background-color: var(--usgs-map-button-bg, #ffffff);
    color: var(--usgs-map-button-fg, #111111);
    border: 1px solid var(--usgs-map-button-border, #cccccc);
    border-radius: 6px;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-size: 16px;
  }

  .controls button:hover {
    background-color: var(--usgs-map-button-hover-bg, #f2f2f2);
  }

  .controls .nudge-n { grid-column: 2; grid-row: 1; }
  .controls .nudge-w { grid-column: 1; grid-row: 2; }
  .controls .nudge-e { grid-column: 3; grid-row: 2; }
  .controls .nudge-s { grid-column: 2; grid-row: 3; }
  .controls .zoom-in { grid-column: 1; grid-row: 4; }
  .controls .zoom-out { grid-column: 3; grid-row: 4; }

  .info-panel {
    bottom: 12px;
    left: 12px;
    width: 300px;
    max-width: calc(100% - 24px);
    padding: 12px;
  }

  .info-panel h2 {
    font-size: 15px;
    margin: 0 0 6px 0;
  }

  .info-panel p,
  .info-panel .hint {
    font-size: 12px;
    margin: 0 0 8px 0;
    color: var(--usgs-map-muted, #444444);
  }

  .info-panel form {
    margin: 0 0 6px 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .info-panel input[type="text"] {
    width: 100%;
    height: 30px;
    padding: 0 8px;
    box-sizing: border-box;
    background-color: var(--usgs-map-button-bg, #ffffff);
    color: var(--usgs-map-fg, #111111);
    border: 1px solid var(--usgs-map-panel-border, #cccccc);
    border-radius: 4px;
    font: inherit;
  }

  .info-panel button {
    height: 30px;
    padding: 0 12px;
    border-radius: 9999px;
    border: 1px solid var(--usgs-map-button-border, #cccccc);
    background-color: var(--usgs-map-button-bg, #ffffff);
    color: var(--usgs-map-button-fg, #111111);
    font: inherit;
    cursor: pointer;
  }

  .info-panel button.primary,
  .info-panel a.link-btn.primary {
    background-color: var(--usgs-map-primary-bg, #0066ff);
    color: var(--usgs-map-primary-fg, #ffffff);
    border-color: var(--usgs-map-primary-bg, #0066ff);
  }

  .info-panel a.link-btn {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border-radius: 9999px;
    border: 1px solid var(--usgs-map-button-border, #cccccc);
    background-color: var(--usgs-map-button-bg, #ffffff);
    color: var(--usgs-map-button-fg, #111111);
    text-decoration: none;
    font-size: 13px;
  }

  .info-panel .actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .map-flash {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    max-width: 90%;
    padding: 8px 14px;
    background-color: var(--usgs-map-flash-bg, #ffe9c2);
    color: var(--usgs-map-flash-fg, #5b3a00);
    border: 1px solid var(--usgs-map-flash-border, #d4a64a);
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }

  .map-error {
    padding: 16px;
    color: #b3261e;
  }

  .add-pin-dialog {
    border: 1px solid var(--usgs-map-panel-border, #cccccc);
    border-radius: 8px;
    padding: 16px;
    min-width: 280px;
    max-width: 360px;
    color: var(--usgs-map-fg, #111111);
    background-color: var(--usgs-map-button-bg, #ffffff);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    font: inherit;
  }

  .add-pin-dialog::backdrop {
    background-color: rgba(0, 0, 0, 0.32);
  }

  .add-pin-dialog form {
    display: grid;
    gap: 8px;
    margin: 0;
  }

  .add-pin-dialog h3 {
    margin: 0;
    font-size: 16px;
  }

  .add-pin-dialog label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: var(--usgs-map-muted, #444444);
  }

  .add-pin-dialog input[type="text"] {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--usgs-map-panel-border, #cccccc);
    border-radius: 4px;
    font: inherit;
    background-color: var(--usgs-map-button-bg, #ffffff);
    color: var(--usgs-map-fg, #111111);
    box-sizing: border-box;
  }

  .add-pin-dialog .coords-preview {
    margin: 0;
    font-size: 11px;
    color: #666666;
  }

  .add-pin-dialog .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 4px;
  }

  .add-pin-dialog button {
    height: 32px;
    padding: 0 14px;
    border-radius: 9999px;
    border: 1px solid var(--usgs-map-button-border, #cccccc);
    background-color: var(--usgs-map-button-bg, #ffffff);
    color: var(--usgs-map-button-fg, #111111);
    font: inherit;
    cursor: pointer;
  }

  .add-pin-dialog button.primary {
    background-color: var(--usgs-map-primary-bg, #0066ff);
    color: var(--usgs-map-primary-fg, #ffffff);
    border-color: var(--usgs-map-primary-bg, #0066ff);
  }
</style>

<div class="map-stage"${hostStyle ? ` style="${hostStyle}"` : ''}>
  <div class="map-grid-wrap"
       data-center-lat="${centerLat}"
       data-center-lon="${centerLon}"
       data-zoom="${zoom}"
       data-grid-cols="${gridCols}"
       data-grid-rows="${gridRows}"
       data-mode="${mode}"
       data-chrome="${minimal ? 'minimal' : 'full'}"
       data-render="${clientRender ? 'client' : 'server'}"
       data-base-url="${escapeAttr(baseUrl)}"
       data-collection-id="${escapeAttr(collectionId)}"${polylineEncoded ? ` data-polyline="${escapeAttr(polylineEncoded)}"` : ''}${Number.isFinite(polylinePrecisionAttr) ? ` data-polyline-precision="${polylinePrecisionAttr}"` : ''}${(wrapShiftX || wrapShiftY) ? ` style="transform: translate(${wrapShiftX}px, ${wrapShiftY}px)"` : ''}>
    <div class="map-grid">
      ${grid.mapTileGrid.map(row => row.map(cell => `
        <div class="tile-container">
          <img class="map-tile" src="${cell.tileUrl}" loading="lazy" width="256" height="256" alt="">
          ${cell.route || ''}
        </div>
      `).join('')).join('')}
    </div>

    ${(clientRender && Array.isArray(polylineCoordinates) && polylineCoordinates.length > 0)
    ? `<script type="application/json" data-polyline-coords>${escapeJsonForScript(JSON.stringify(polylineCoordinates))}</script>`
    : ''}

    <slot></slot>
  </div>

  ${showCrosshair ? '<div class="center-crosshair" aria-hidden="true"></div>' : ''}

  ${showScale ? `<div class="map-scale-default"><map-scale lat="${centerLat}" zoom="${zoom}" width="80" units="dual"></map-scale></div>` : ''}

  ${showControls ? `
  <div class="panel controls" role="group" aria-label="Map controls">
    <form action="${baseUrl}" method="GET" class="nudge-n" data-nav-action="pan-n">
      ${nudgeFields(0, -FULL_TILE)}
      <button type="submit" aria-label="Pan north">&#9650;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="nudge-w" data-nav-action="pan-w">
      ${nudgeFields(-FULL_TILE, 0)}
      <button type="submit" aria-label="Pan west">&#9664;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="nudge-e" data-nav-action="pan-e">
      ${nudgeFields(FULL_TILE, 0)}
      <button type="submit" aria-label="Pan east">&#9654;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="nudge-s" data-nav-action="pan-s">
      ${nudgeFields(0, FULL_TILE)}
      <button type="submit" aria-label="Pan south">&#9660;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="zoom-in" data-nav-action="zoom-in">
      ${zoomInFields}
      <button type="submit" aria-label="Zoom in">+</button>
    </form>
    <form action="${baseUrl}" method="GET" class="zoom-out" data-nav-action="zoom-out">
      ${zoomOutFields}
      <button type="submit" aria-label="Zoom out">&minus;</button>
    </form>
  </div>` : ''}

  ${showInfo ? (mode === 'create'
    ? renderCreatorPanel({ centerLat, centerLon, zoom, draftPinCount, fit, fitHref: fitHref(baseUrl, fit, gridCols, gridRows, viewW, viewH) })
    : renderViewerPanel({ title, collectionId, fit, fitHref: fitHref(baseUrl, fit, gridCols, gridRows, viewW, viewH) })) : ''}

  ${(!minimal && mode === 'create') ? `
  <dialog class="add-pin-dialog" aria-label="Add map pin">
    <form method="POST" action="/c/new/add">
      <h3>New pin</h3>
      <input type="hidden" name="lat" data-pin-lat value="">
      <input type="hidden" name="lon" data-pin-lon value="">
      <input type="hidden" name="zoom" data-pin-zoom value="${zoom}">
      <label>Name <input type="text" name="name" maxlength="80"></label>
      <label>Note <input type="text" name="note" maxlength="200"></label>
      <p class="coords-preview" data-pin-coords></p>
      <div class="dialog-actions">
        <button type="submit" formmethod="dialog" formnovalidate data-cancel-pin>Cancel</button>
        <button type="submit" class="primary">Add pin</button>
      </div>
    </form>
  </dialog>` : ''}

  ${flash ? `<div class="map-flash" role="status">${escapeText(flash)}</div>` : ''}
</div>

${noScript ? '' : renderScript()}
`
}

function renderScript () {
  return `
<script type="module">
import {
  PIXELS_PER_TILE,
  pixelToLatLon,
  latLonToGlobalPixel as latLonToGlobal,
  globalPixelToLatLon as globalToLatLon,
  latLonToGridPixel,
  buildTileGrid,
  generateRouteSVG,
  decodePolyline
} from '${TILES_LIB_URL}'

if (!customElements.get('usgs-map')) {
  const DRAG_THRESHOLD = 5
  const SNAP_MS = 130
  const PINCH_ZOOM_IN = 1.5
  const PINCH_ZOOM_OUT = 1 / 1.5
  const RESIZE_DEBOUNCE_MS = 350
  const MIN_GRID_EDITOR = 5
  const MIN_GRID_PREVIEW = 3
  const MAX_GRID = 13

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

  // Optimal grid for an arbitrary container size. We measure the host
  // element (not window.innerWidth) so this works in iframes, fixed-size
  // divs, AND full-page layouts.
  function optimalGrid (containerW, containerH, minimal) {
    const min = minimal ? MIN_GRID_PREVIEW : MIN_GRID_EDITOR
    let cols = Math.ceil(containerW / PIXELS_PER_TILE) + 1
    let rows = Math.ceil(containerH / PIXELS_PER_TILE) + 1
    if (cols % 2 === 0) cols += 1
    if (rows % 2 === 0) rows += 1
    return {
      cols: clamp(cols, min, MAX_GRID),
      rows: clamp(rows, min, MAX_GRID)
    }
  }

  class UsgsMap extends HTMLElement {
    connectedCallback () {
      this.wrap = this.querySelector('.map-grid-wrap')
      if (!this.wrap) return
      const d = this.wrap.dataset
      this.centerLat = parseFloat(d.centerLat)
      this.centerLon = parseFloat(d.centerLon)
      this.zoom = parseInt(d.zoom, 10)
      this.gridCols = parseInt(d.gridCols, 10) || 7
      this.gridRows = parseInt(d.gridRows, 10) || 7
      this.mode = d.mode || 'view'
      this.minimal = d.chrome === 'minimal'
      this.collectionId = d.collectionId || ''
      this.baseUrl = d.baseUrl || window.location.pathname
      this.clientRender = d.render === 'client'
      // Polyline coords for the route overlay. Shared across rerenders so
      // pan/zoom keeps the same route on screen. Two SSR delivery paths:
      // (a) data-polyline encoded string on the wrap, with optional
      // data-polyline-precision. (b) An inline application/json script tag
      // with data-polyline-coords carrying the already-decoded coords (used
      // when state.store.polylineCoordinates is set, e.g. /demo/route).
      this.polylineCoordinates = this.extractPolyline()
      this.stageX = (this.gridCols * PIXELS_PER_TILE) / 2
      this.stageY = (this.gridRows * PIXELS_PER_TILE) / 2
      // Crosshair sits at the stage's geometric center. The SSR translates
      // the wrap so the lat/lon center lands exactly there, which means in
      // *wrap-local* coordinates the crosshair is at (crossX, crossY) — the
      // lat/lon center's natural position inside the wrap. All gesture →
      // lat/lon math is anchored here, so a free-pan drag can be applied
      // verbatim (no tile-snap) and still match the next SSR exactly.
      const cross = this.computeCrosshair(this.centerLat, this.centerLon, this.zoom, this.gridCols, this.gridRows)
      this.crossX = cross.x
      this.crossY = cross.y
      // Static wrap shift, mirrored from the SSR. Every gesture transform
      // adds (dx, dy) on top of this so the SSR-applied baseline is never
      // dropped — that was causing "click jumps the map by ~half a tile"
      // when onMove blew away the inline transform.
      this.wrapShiftX = Math.round(this.stageX - this.crossX)
      this.wrapShiftY = Math.round(this.stageY - this.crossY)

      this.pointers = new Map()
      this.dragging = false
      this.pinching = false
      this.animating = false
      this.dragPointerId = null
      this.dragStartX = 0
      this.dragStartY = 0
      this.dx = 0
      this.dy = 0
      this.pinchStart = null
      this.pinchScale = 1
      this.residualPointers = new Set()
      this.lastSize = { w: 0, h: 0 }
      this.resizeReady = false

      this.onDown = this.onDown.bind(this)
      this.onMove = this.onMove.bind(this)
      this.onUp = this.onUp.bind(this)
      this.onCancel = this.onCancel.bind(this)
      this.onDblClick = this.onDblClick.bind(this)
      this.onKeydown = this.onKeydown.bind(this)
      this.onDocClick = this.onDocClick.bind(this)
      this.onResizeEntry = this.onResizeEntry.bind(this)
      this.onChildSubmit = this.onChildSubmit.bind(this)
      this.onGeocodeResult = this.onGeocodeResult.bind(this)

      if (!this.minimal) {
        this.wrap.addEventListener('pointerdown', this.onDown)
        this.wrap.addEventListener('pointermove', this.onMove)
        this.wrap.addEventListener('pointerup', this.onUp)
        this.wrap.addEventListener('pointercancel', this.onCancel)
        this.wrap.addEventListener('dblclick', this.onDblClick)
        this.wrap.style.cursor = ''
      } else {
        this.wrap.style.cursor = 'default'
      }
      document.addEventListener('keydown', this.onKeydown)
      document.addEventListener('click', this.onDocClick)

      // Listen for submit events from any descendant form. <map-nav> and
      // the built-in chrome both emit these — we intercept and call our
      // own imperative methods so the page doesn't full-navigate.
      this.addEventListener('submit', this.onChildSubmit)
      // <address-search> / <route-search> dispatch these on success.
      this.addEventListener('geocode:result', this.onGeocodeResult)

      this.dialog = this.querySelector('.add-pin-dialog')
      this.installPinPopovers()

      // Watch our own size, not the window's. Survives iframes and divs.
      this.ro = new ResizeObserver(this.onResizeEntry)
      this.ro.observe(this)
    }

    disconnectedCallback () {
      document.removeEventListener('keydown', this.onKeydown)
      document.removeEventListener('click', this.onDocClick)
      if (this.ro) this.ro.disconnect()
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
    }

    // Apply a gesture transform on top of the static wrap shift. The shift
    // is the SSR-rendered translate(...) that puts the lat/lon center at
    // the crosshair; we must keep it in every transform we set, otherwise
    // the wrap visibly jumps by (wrapShiftX, wrapShiftY) at the start of
    // each gesture and again at release.
    applyTransform (dx, dy, scale) {
      const tx = this.wrapShiftX + (dx || 0)
      const ty = this.wrapShiftY + (dy || 0)
      this.wrap.style.transform = scale != null
        ? 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')'
        : 'translate(' + tx + 'px, ' + ty + 'px)'
    }

    // Read polyline coords once at mount. Returns null if no overlay.
    extractPolyline () {
      const json = this.querySelector('script[type="application/json"][data-polyline-coords]')
      if (json) {
        try {
          const parsed = JSON.parse(json.textContent)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        } catch (_e) { /* fall through to data-polyline */ }
      }
      const encoded = this.wrap?.dataset?.polyline
      if (typeof encoded === 'string' && encoded.length > 0) {
        const precision = parseInt(this.wrap.dataset.polylinePrecision, 10)
        try {
          return decodePolyline(encoded, Number.isFinite(precision) ? precision : 6)
        } catch (_e) { /* ignore */ }
      }
      return null
    }

    // Wrap-local position of the crosshair. The SSR shifts the wrap so the
    // lat/lon center coincides with the stage's geometric center, so the
    // crosshair lives at the lat/lon's natural position inside the wrap.
    computeCrosshair (lat, lon, zoom, cols, rows) {
      const total = Math.pow(2, zoom) * PIXELS_PER_TILE
      const sinLat = Math.sin((lat * Math.PI) / 180)
      const cx = ((lon + 180) / 360) * total
      const cy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * total
      const centerCol = Math.floor((cols - 1) / 2)
      const centerRow = Math.floor((rows - 1) / 2)
      const offX = cx - Math.floor(cx / PIXELS_PER_TILE) * PIXELS_PER_TILE
      const offY = cy - Math.floor(cy / PIXELS_PER_TILE) * PIXELS_PER_TILE
      return {
        x: centerCol * PIXELS_PER_TILE + offX,
        y: centerRow * PIXELS_PER_TILE + offY
      }
    }

    // ─── Imperative API ────────────────────────────────────────────────
    zoomIn () { this.setView({ zoom: clamp(this.zoom + 1, 0, 16) }) }
    zoomOut () { this.setView({ zoom: clamp(this.zoom - 1, 0, 16) }) }
    // panBy(dx, dy): shift the *view* by (dx, dy) screen pixels. So
    // panBy(0, -256) pans north (the world's northern content slides into
    // the crosshair). Anchored on the crosshair, not the wrap's geometric
    // center.
    panBy (dx, dy) {
      const next = pixelToLatLon(
        this.crossX + dx, this.crossY + dy,
        this.zoom, this.centerLat, this.centerLon,
        this.gridCols, this.gridRows
      )
      this.setView({ lat: next.lat, lon: next.lon })
    }
    setView (view) {
      const lat = Number.isFinite(view?.lat) ? view.lat : this.centerLat
      const lon = Number.isFinite(view?.lon) ? view.lon : this.centerLon
      const zoom = Number.isFinite(view?.zoom) ? clamp(parseInt(view.zoom, 10), 0, 16) : this.zoom
      this.navigate(lat, lon, zoom)
    }
    fitPins () {
      this.refit()
    }

    // ─── Pin popover enhancements ──────────────────────────────────────
    installPinPopovers () {
      const detailsList = this.querySelectorAll('map-pin details')
      detailsList.forEach(d => {
        d.addEventListener('toggle', () => {
          if (!d.open) return
          detailsList.forEach(other => { if (other !== d) other.open = false })
        })
      })
      this._openDetails = () => Array.from(this.querySelectorAll('map-pin details[open]'))
    }

    onKeydown (e) {
      if (e.key !== 'Escape') return
      const open = this._openDetails ? this._openDetails() : []
      if (open.length === 0) return
      e.preventDefault()
      open.forEach(d => {
        d.open = false
        const summary = d.querySelector('summary')
        if (summary) try { summary.focus() } catch {}
      })
    }

    onDocClick (e) {
      const open = this._openDetails ? this._openDetails() : []
      if (open.length === 0) return
      open.forEach(d => {
        if (!d.contains(e.target)) d.open = false
      })
    }

    // ─── Slotted child interception ────────────────────────────────────
    onChildSubmit (e) {
      const form = e.target.closest('form')
      if (!form) return
      // If the form targets a different frame (iframe), let it submit.
      if (form.target && form.target !== '_self') return
      // Built-in chrome forms have data-nav-action; <map-nav> has
      // data-action on each form cell. Either is a hint we should hijack.
      const action = form.dataset.navAction || form.dataset.action
      if (!action) return
      e.preventDefault()
      switch (action) {
      case 'zoom-in': this.zoomIn(); break
      case 'zoom-out': this.zoomOut(); break
      case 'pan-n': this.panBy(0, -PIXELS_PER_TILE); break
      case 'pan-s': this.panBy(0, PIXELS_PER_TILE); break
      case 'pan-w': this.panBy(-PIXELS_PER_TILE, 0); break
      case 'pan-e': this.panBy(PIXELS_PER_TILE, 0); break
      case 'locate':
        // <map-nav>'s own locate handler will dispatch mapnav:locate when
        // the geolocation resolves; we just need to not navigate here.
        break
      }
    }

    onGeocodeResult (e) {
      const d = e.detail
      if (!d || !Number.isFinite(d.lat) || !Number.isFinite(d.lon)) return
      this.setView({ lat: d.lat, lon: d.lon, zoom: d.zoom })
    }

    // ─── Resize handling ───────────────────────────────────────────────
    onResizeEntry (entries) {
      for (const entry of entries) {
        const cr = entry.contentRect
        const w = Math.round(cr.width)
        const h = Math.round(cr.height)
        if (!w || !h) continue

        // First non-zero observation: check if the SSR grid matches our
        // measured size. If not, refit (server will pick fresh center+zoom).
        if (!this.resizeReady) {
          this.resizeReady = true
          this.lastSize = { w, h }
          const optimal = optimalGrid(w, h, this.minimal)
          if (optimal.cols !== this.gridCols || optimal.rows !== this.gridRows) {
            // Defer one frame so the current render settles.
            requestAnimationFrame(() => this.refit({ cols: optimal.cols, rows: optimal.rows, w, h }))
          }
          continue
        }

        // Subsequent resizes: debounced. Only refit if grid would change.
        if (w === this.lastSize.w && h === this.lastSize.h) continue
        this.lastSize = { w, h }
        if (this.resizeTimer) clearTimeout(this.resizeTimer)
        this.resizeTimer = setTimeout(() => {
          if (!this.canAutoNavigate()) return
          const optimal = optimalGrid(w, h, this.minimal)
          if (optimal.cols === this.gridCols && optimal.rows === this.gridRows) return
          this.refit({ cols: optimal.cols, rows: optimal.rows, w, h })
        }, RESIZE_DEBOUNCE_MS)
      }
    }

    canAutoNavigate () {
      if (this.dragging || this.pinching || this.animating) return false
      if (this.dialog && this.dialog.open) return false
      const ae = document.activeElement
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return false
      return true
    }

    // ─── Pointer plumbing ──────────────────────────────────────────────
    onDown (e) {
      if (this.animating) return
      if (e.target.closest('map-pin, button, a, input, summary, details, form, dialog')) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (this.pointers.size === 2 && !this.pinching) {
        this.cancelDrag()
        this.startPinch()
        return
      }

      if (this.pointers.size === 1 && !this.dragging && !this.pinching && !this.residualPointers.has(e.pointerId)) {
        this.startDrag(e.pointerId, e.clientX, e.clientY)
      }
    }

    onMove (e) {
      if (this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }
      if (this.pinching) {
        this.updatePinch()
        return
      }
      if (this.dragging && e.pointerId === this.dragPointerId) {
        this.dx = e.clientX - this.dragStartX
        this.dy = e.clientY - this.dragStartY
        this.applyTransform(this.dx, this.dy)
      }
    }

    onUp (e) {
      const wasInPointers = this.pointers.has(e.pointerId)
      this.pointers.delete(e.pointerId)
      this.residualPointers.delete(e.pointerId)

      if (this.pinching) {
        if (this.pointers.size < 2) {
          for (const id of this.pointers.keys()) this.residualPointers.add(id)
          this.endPinch()
        }
        return
      }

      if (this.dragging && e.pointerId === this.dragPointerId) {
        this.endDrag(e.clientX, e.clientY, wasInPointers)
        return
      }
    }

    onCancel (e) {
      this.pointers.delete(e.pointerId)
      this.residualPointers.delete(e.pointerId)
      if (this.pinching) {
        this.abortPinch()
        return
      }
      if (this.dragging && e.pointerId === this.dragPointerId) {
        this.cancelDrag()
      }
    }

    // ─── Drag ──────────────────────────────────────────────────────────
    startDrag (pointerId, x, y) {
      this.dragging = true
      this.dragPointerId = pointerId
      this.dragStartX = x
      this.dragStartY = y
      this.dx = 0
      this.dy = 0
      this.wrap.classList.remove('snapping')
      this.wrap.classList.add('dragging')
      try { this.wrap.setPointerCapture(pointerId) } catch {}
    }

    endDrag (clientX, clientY, wasClick) {
      const dx = this.dx, dy = this.dy
      this.dragging = false
      this.dragPointerId = null
      this.wrap.classList.remove('dragging')

      const moved = Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD
      if (moved) {
        // Drag freely — no snap-to-tile. The new center is whatever world
        // point is now under the crosshair. Because the SSR translates the
        // wrap so the lat/lon center always sits at the crosshair, the
        // re-rendered page picks a matching shift and the view stays put
        // across the navigation. Leaving the inline transform in place
        // keeps the old wrap pinned to the user's release position until
        // the new HTML commits.
        const next = pixelToLatLon(
          this.crossX - dx, this.crossY - dy,
          this.zoom, this.centerLat, this.centerLon,
          this.gridCols, this.gridRows
        )
        this.animating = true
        this.navigate(next.lat, next.lon, this.zoom)
        return
      }

      if (wasClick && this.mode === 'create') {
        const rect = this.wrap.getBoundingClientRect()
        // rect.left already includes the wrap shift (it's part of the
        // transform), so clientX - rect.left gives a screen-relative
        // coordinate. To translate that into the *unshifted* wrap-local
        // frame that pixelToLatLon expects, subtract the shift back out.
        const px = clientX - rect.left + this.wrapShiftX
        const py = clientY - rect.top + this.wrapShiftY
        const { lat, lon } = pixelToLatLon(px, py, this.zoom, this.centerLat, this.centerLon, this.gridCols, this.gridRows)
        this.dispatchEvent(new CustomEvent('map:select', { bubbles: true, detail: { lat, lon } }))
        this.openAddPinDialog(lat, lon)
      }
      this.applyTransform(0, 0)
    }

    cancelDrag () {
      if (!this.dragging) return
      this.dragging = false
      this.dragPointerId = null
      this.dx = 0
      this.dy = 0
      this.wrap.classList.remove('dragging')
      this.wrap.classList.remove('snapping')
      this.applyTransform(0, 0)
    }

    // ─── Pinch ─────────────────────────────────────────────────────────
    startPinch () {
      const pts = Array.from(this.pointers.values())
      if (pts.length < 2) return
      const a = pts[0], b = pts[1]
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const rect = this.wrap.getBoundingClientRect()
      this.pinching = true
      this.pinchStart = {
        dist, midX, midY,
        rectLeft: rect.left, rectTop: rect.top,
        localX: midX - rect.left, localY: midY - rect.top
      }
      this.pinchScale = 1
      this.wrap.style.transformOrigin = this.pinchStart.localX + 'px ' + this.pinchStart.localY + 'px'
      this.wrap.classList.remove('snapping')
      this.wrap.classList.add('pinching')
    }

    updatePinch () {
      if (!this.pinchStart) return
      const pts = Array.from(this.pointers.values())
      if (pts.length < 2) return
      const a = pts[0], b = pts[1]
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const s = dist / this.pinchStart.dist
      const tx = midX - this.pinchStart.midX
      const ty = midY - this.pinchStart.midY
      this.pinchScale = s
      this.applyTransform(tx, ty, s)
    }

    endPinch () {
      const s = this.pinchScale
      let zoomDelta = 0
      if (s >= PINCH_ZOOM_IN) zoomDelta = 1
      else if (s <= PINCH_ZOOM_OUT) zoomDelta = -1

      if (zoomDelta === 0) {
        this.wrap.classList.add('snapping')
        this.applyTransform(0, 0)
        setTimeout(() => {
          this.wrap.classList.remove('snapping')
          this.wrap.classList.remove('pinching')
          this.wrap.style.transformOrigin = ''
          this.pinching = false
          this.pinchStart = null
          this.pinchScale = 1
        }, SNAP_MS)
        return
      }

      const newZoom = clamp(this.zoom + zoomDelta, 0, 16)
      // pinchStart.rect is the post-transform rect — it already has the
      // wrap shift baked in. pixelToLatLon expects coords in the wrap's
      // pre-transform box, and the on-screen position of the lat/lon
      // center is rect.left + crossX (not rect.left + stageX). Fold both
      // corrections in here.
      const px = this.pinchStart.localX + this.wrapShiftX
      const py = this.pinchStart.localY + this.wrapShiftY
      const L = pixelToLatLon(px, py, this.zoom, this.centerLat, this.centerLon, this.gridCols, this.gridRows)
      const Lglobal = latLonToGlobal(L.lat, L.lon, newZoom)
      const screenCenterX = this.pinchStart.rectLeft + this.crossX
      const screenCenterY = this.pinchStart.rectTop + this.crossY
      const offX = this.pinchStart.midX - screenCenterX
      const offY = this.pinchStart.midY - screenCenterY
      let Cx = Lglobal.x - offX
      let Cy = Lglobal.y - offY
      Cx = Math.round((Cx - PIXELS_PER_TILE / 2) / PIXELS_PER_TILE) * PIXELS_PER_TILE + PIXELS_PER_TILE / 2
      Cy = Math.round((Cy - PIXELS_PER_TILE / 2) / PIXELS_PER_TILE) * PIXELS_PER_TILE + PIXELS_PER_TILE / 2
      const C = globalToLatLon(Cx, Cy, newZoom)
      this.navigate(C.lat, C.lon, newZoom)
    }

    abortPinch () {
      this.pinching = false
      this.pinchStart = null
      this.pinchScale = 1
      this.wrap.classList.remove('pinching')
      this.wrap.classList.remove('snapping')
      this.applyTransform(0, 0)
      this.wrap.style.transformOrigin = ''
    }

    onDblClick (e) {
      if (this.mode === 'create') return
      if (e.target.closest('map-pin, button, a, input, summary, details, form, dialog')) return
      if (this.zoom >= 16) return
      const rect = this.wrap.getBoundingClientRect()
      const px = e.clientX - rect.left + this.wrapShiftX
      const py = e.clientY - rect.top + this.wrapShiftY
      const { lat, lon } = pixelToLatLon(px, py, this.zoom, this.centerLat, this.centerLon, this.gridCols, this.gridRows)
      this.navigate(lat, lon, this.zoom + 1)
    }

    // ─── Client-side rerender ──────────────────────────────────────────
    // Used only when render="client". Rebuilds the tile-grid DOM, pin
    // positions, and (if any) polyline overlay in place — no full-page
    // navigation. URL is still updated via history.replaceState so reload,
    // share, and back/forward keep working. Falls through to navigate()
    // for server-rendered mode (the default).
    rerender ({ lat, lon, zoom, cols, rows } = {}) {
      if (!this.wrap) return
      const newLat = Number.isFinite(lat) ? lat : this.centerLat
      const newLon = Number.isFinite(lon) ? lon : this.centerLon
      const newZoom = Number.isFinite(zoom)
        ? clamp(parseInt(zoom, 10), 0, 16)
        : this.zoom
      const newCols = Number.isFinite(cols) ? cols : this.gridCols
      const newRows = Number.isFinite(rows) ? rows : this.gridRows

      const grid = buildTileGrid({
        latitude: newLat,
        longitude: newLon,
        zoom: newZoom,
        rows: newRows,
        cols: newCols,
        polylineCoordinates: this.polylineCoordinates || null
      })

      // If grid dims changed, override the SSR-baked CSS dimensions via
      // inline style. (.map-grid-wrap and .map-grid sizes were rendered
      // into the scoped <style> block at SSR time.)
      const dimsChanged = newCols !== this.gridCols || newRows !== this.gridRows
      if (dimsChanged) {
        this.wrap.style.width = (newCols * PIXELS_PER_TILE) + 'px'
        this.wrap.style.height = (newRows * PIXELS_PER_TILE) + 'px'
      }

      // Reconcile .tile-container children. Re-using existing <img> nodes
      // when their src already matches keeps the browser tile cache warm
      // across pans within the same zoom level.
      const gridEl = this.querySelector('.map-grid')
      if (gridEl) {
        if (dimsChanged) {
          gridEl.style.gridTemplateColumns = 'repeat(' + newCols + ', ' + PIXELS_PER_TILE + 'px)'
          gridEl.style.gridTemplateRows = 'repeat(' + newRows + ', ' + PIXELS_PER_TILE + 'px)'
        }
        const totalCells = newRows * newCols
        const containers = Array.from(gridEl.querySelectorAll(':scope > .tile-container'))
        while (containers.length < totalCells) {
          const c = document.createElement('div')
          c.className = 'tile-container'
          const img = document.createElement('img')
          img.className = 'map-tile'
          img.width = PIXELS_PER_TILE
          img.height = PIXELS_PER_TILE
          img.alt = ''
          img.loading = 'lazy'
          c.appendChild(img)
          gridEl.appendChild(c)
          containers.push(c)
        }
        while (containers.length > totalCells) {
          containers.pop().remove()
        }
        let k = 0
        for (let i = 0; i < newRows; i++) {
          for (let j = 0; j < newCols; j++) {
            const cell = grid.mapTileGrid[i][j]
            const container = containers[k++]
            const img = container.querySelector('img.map-tile')
            if (img && img.getAttribute('src') !== cell.tileUrl) {
              img.setAttribute('src', cell.tileUrl)
            }
            const oldSvg = container.querySelector('svg.route-overlay')
            if (cell.route) {
              if (oldSvg) {
                const tmp = document.createElement('div')
                tmp.innerHTML = cell.route
                const newSvg = tmp.firstElementChild
                if (newSvg) container.replaceChild(newSvg, oldSvg)
              } else {
                container.insertAdjacentHTML('beforeend', cell.route)
              }
            } else if (oldSvg) {
              oldSvg.remove()
            }
          }
        }
      }

      // Reposition <map-pin> children. They live as light-DOM siblings of
      // .map-grid inside .map-grid-wrap; their .map-pin-anchor div has
      // inline style.left/top in wrap-local pixels.
      const totalW = newCols * PIXELS_PER_TILE
      const totalH = newRows * PIXELS_PER_TILE
      const margin = 32
      this.querySelectorAll('map-pin').forEach(pin => {
        const plat = parseFloat(pin.getAttribute('lat'))
        const plon = parseFloat(pin.getAttribute('lon'))
        if (!Number.isFinite(plat) || !Number.isFinite(plon)) return
        const anchor = pin.querySelector('.map-pin-anchor')
        if (!anchor) return
        const { x, y } = latLonToGridPixel(plat, plon, newZoom, newLat, newLon, newCols, newRows)
        if (x < -margin || y < -margin || x > totalW + margin || y > totalH + margin) {
          anchor.style.display = 'none'
        } else {
          anchor.style.display = ''
          anchor.style.left = x.toFixed(1) + 'px'
          anchor.style.top = y.toFixed(1) + 'px'
        }
      })

      // Update wrap dataset + instance fields. computeCrosshair returns the
      // wrap-local position of the lat/lon center (= the screen position of
      // the crosshair after the wrap shift is applied).
      this.wrap.dataset.centerLat = String(newLat)
      this.wrap.dataset.centerLon = String(newLon)
      this.wrap.dataset.zoom = String(newZoom)
      this.wrap.dataset.gridCols = String(newCols)
      this.wrap.dataset.gridRows = String(newRows)
      this.centerLat = newLat
      this.centerLon = newLon
      this.zoom = newZoom
      this.gridCols = newCols
      this.gridRows = newRows
      this.stageX = (newCols * PIXELS_PER_TILE) / 2
      this.stageY = (newRows * PIXELS_PER_TILE) / 2
      const cross = this.computeCrosshair(newLat, newLon, newZoom, newCols, newRows)
      this.crossX = cross.x
      this.crossY = cross.y
      this.wrapShiftX = Math.round(this.stageX - this.crossX)
      this.wrapShiftY = Math.round(this.stageY - this.crossY)

      this.dx = 0
      this.dy = 0
      this.animating = false
      this.wrap.classList.remove('snapping', 'dragging', 'pinching')
      this.wrap.style.transformOrigin = ''
      this.applyTransform(0, 0)

      // <map-scale> registers its own Custom Element class and observes
      // lat/zoom/width/units, so this attr update triggers an in-place
      // re-render of the bar — no full page nav needed.
      const scale = this.querySelector('map-scale')
      if (scale) {
        scale.setAttribute('lat', String(newLat))
        scale.setAttribute('zoom', String(newZoom))
      }

      this.dispatchEvent(new CustomEvent('map:move', {
        bubbles: true,
        detail: { lat: newLat, lon: newLon, zoom: newZoom }
      }))

      if (this.ownsUrl()) {
        const rect = this.getBoundingClientRect()
        const w = Math.round(rect.width) || this.lastSize.w || window.innerWidth
        const h = Math.round(rect.height) || this.lastSize.h || window.innerHeight
        const url = new URL(window.location.href)
        url.searchParams.set('lat', newLat.toFixed(6))
        url.searchParams.set('lon', newLon.toFixed(6))
        url.searchParams.set('zoom', String(newZoom))
        url.searchParams.set('cols', String(newCols))
        url.searchParams.set('rows', String(newRows))
        url.searchParams.set('w', String(w))
        url.searchParams.set('h', String(h))
        url.searchParams.delete('fit')
        try {
          history.replaceState({}, '', url.pathname + url.search)
        } catch (_e) { /* SecurityError on cross-origin iframe; ignore */ }
      }
    }

    // ─── Navigation ────────────────────────────────────────────────────
    // Owns its URL? Only navigate when the map's base-url matches the
    // current pathname. Otherwise the map is embedded on someone else's
    // page (or in a sibling slot) and a window.location.assign would
    // reload the host — and, with ResizeObserver in the picture, infinite
    // loop. Embedded maps stay at their initial SSR; gestures dispatch
    // map:move events the consumer can handle however they like.
    ownsUrl () {
      try {
        const target = new URL(this.baseUrl, window.location.href)
        return target.pathname === window.location.pathname
      } catch (_e) {
        return false
      }
    }

    // Build the new URL from the current location so any extra query params
    // (e.g. ?preview=1) are preserved automatically.
    navigate (lat, lon, zoom, cols, rows) {
      // In client-render mode rerender() handles map:move dispatch, DOM
      // update, and history.replaceState all in one. Bail before the
      // server-roundtrip path so we don't double-fire events or assign
      // a new location.
      if (this.clientRender) {
        return this.rerender({ lat, lon, zoom, cols, rows })
      }
      this.dispatchEvent(new CustomEvent('map:move', { bubbles: true, detail: { lat, lon, zoom } }))
      if (!this.ownsUrl()) {
        // Page nav suppressed (we don't own the URL). Clear any pending
        // gesture transform so the wrap doesn't sit half-translated and
        // expose a strip of host background. Map content snaps back to its
        // SSR position; consumers can react via the map:move event above.
        this.resetWrapTransform()
        return
      }
      const c = cols || this.gridCols
      const r = rows || this.gridRows
      const rect = this.getBoundingClientRect()
      const w = Math.round(rect.width) || this.lastSize.w || window.innerWidth
      const h = Math.round(rect.height) || this.lastSize.h || window.innerHeight
      const url = new URL(window.location.href)
      url.searchParams.set('lat', lat.toFixed(6))
      url.searchParams.set('lon', lon.toFixed(6))
      url.searchParams.set('zoom', String(zoom))
      url.searchParams.set('cols', String(c))
      url.searchParams.set('rows', String(r))
      url.searchParams.set('w', String(w))
      url.searchParams.set('h', String(h))
      url.searchParams.delete('fit')
      window.location.assign(url.pathname + url.search)
    }

    // Reset any inline transform / animation classes left by a gesture.
    // Used both internally and as a no-op fallback when navigate() bails.
    // Reset goes back to the static wrap shift, NOT to no-transform —
    // otherwise the wrap snaps off-crosshair by (wrapShiftX, wrapShiftY).
    resetWrapTransform () {
      if (!this.wrap) return
      this.wrap.classList.remove('snapping', 'dragging', 'pinching')
      this.applyTransform(0, 0)
      this.wrap.style.transformOrigin = ''
      this.dx = 0
      this.dy = 0
      this.animating = false
      this.pinching = false
      this.pinchStart = null
      this.pinchScale = 1
    }

    // Refit: drop lat/lon/zoom and signal the server to recompute bbox-fit
    // using w/h. This is the key bug fix — the previous implementation
    // carried stale lat/lon/zoom forward and the server's "user pinned a
    // view" branch defeated bbox-fit.
    refit ({ cols, rows, w, h } = {}) {
      // Client-render mode: just rebuild the grid at the new dimensions
      // around the existing center. The server-side bbox-fit branch is
      // skipped — pins/route stay roughly in view since center/zoom don't
      // change, and the new grid covers the new container size.
      if (this.clientRender) {
        return this.rerender({ cols, rows })
      }
      if (!this.ownsUrl()) return
      const url = new URL(window.location.href)
      url.searchParams.delete('lat')
      url.searchParams.delete('lon')
      url.searchParams.delete('zoom')
      url.searchParams.set('fit', '1')
      if (cols) url.searchParams.set('cols', String(cols))
      if (rows) url.searchParams.set('rows', String(rows))
      const rect = this.getBoundingClientRect()
      const ww = w || Math.round(rect.width) || this.lastSize.w || window.innerWidth
      const hh = h || Math.round(rect.height) || this.lastSize.h || window.innerHeight
      url.searchParams.set('w', String(ww))
      url.searchParams.set('h', String(hh))
      window.location.assign(url.pathname + url.search)
    }

    openAddPinDialog (lat, lon) {
      if (!this.dialog || typeof this.dialog.showModal !== 'function') {
        this.legacyAddPin(lat, lon)
        return
      }
      const form = this.dialog.querySelector('form')
      form.querySelector('[data-pin-lat]').value = lat.toFixed(6)
      form.querySelector('[data-pin-lon]').value = lon.toFixed(6)
      form.querySelector('[data-pin-zoom]').value = String(this.zoom)
      const preview = form.querySelector('[data-pin-coords]')
      if (preview) preview.textContent = lat.toFixed(5) + ', ' + lon.toFixed(5)
      if (form.elements.name) form.elements.name.value = ''
      if (form.elements.note) form.elements.note.value = ''
      this.dialog.showModal()
      if (form.elements.name) {
        try { form.elements.name.focus() } catch {}
      }
    }

    legacyAddPin (lat, lon) {
      const name = window.prompt('Pin name (optional)')
      if (name === null) return
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = '/c/new/add'
      form.style.display = 'none'
      const fields = {
        lat: lat.toFixed(6),
        lon: lon.toFixed(6),
        zoom: String(this.zoom),
        name: name || ''
      }
      for (const k in fields) {
        const i = document.createElement('input')
        i.type = 'hidden'
        i.name = k
        i.value = fields[k]
        form.appendChild(i)
      }
      document.body.appendChild(form)
      form.submit()
    }
  }

  customElements.define('usgs-map', UsgsMap)
}
</script>`
}

function renderCreatorPanel ({ centerLat, centerLon, zoom, draftPinCount, fit: _fit, fitHref }) {
  return `
<div class="panel info-panel">
  <h2>New collection (${draftPinCount} pin${draftPinCount === 1 ? '' : 's'})</h2>
  <p class="hint">Click anywhere on the map to drop a pin. Drag to pan, pinch (or +/-) to zoom. The form below adds a pin at the center.</p>

  <form action="/c/new/add" method="POST">
    <input type="hidden" name="lat" value="${centerLat}">
    <input type="hidden" name="lon" value="${centerLon}">
    <input type="hidden" name="zoom" value="${zoom}">
    <input type="text" name="name" placeholder="Pin name (optional)" maxlength="80">
    <input type="text" name="note" placeholder="Note (optional)" maxlength="200">
    <div class="actions">
      ${fitHref ? `<a class="link-btn" href="${fitHref}">Fit pins</a>` : ''}
      <button type="submit" class="primary">Add pin at center</button>
    </div>
  </form>

  <form action="/c" method="POST">
    <input type="hidden" name="lat" value="${centerLat}">
    <input type="hidden" name="lon" value="${centerLon}">
    <input type="hidden" name="zoom" value="${zoom}">
    <input type="text" name="title" placeholder="Collection title (optional)" maxlength="80">
    <div class="actions">
      <button type="submit" formaction="/c/new/clear" formnovalidate>Clear all</button>
      <button type="submit" class="primary"${draftPinCount === 0 ? ' disabled' : ''}>Save collection</button>
    </div>
  </form>
</div>
`
}

function renderViewerPanel ({ title, collectionId, fitHref }) {
  return `
<div class="panel info-panel">
  <h2>${title ? escapeText(title) : 'Collection'}</h2>
  <p class="hint">Click a pin for details, or use the arrows to pan. Pin links re-center the map.</p>
  <div class="actions">
    <a class="link-btn" href="/c/new">New collection</a>
    ${fitHref ? `<a class="link-btn primary" href="${fitHref}">Fit pins</a>` : (collectionId ? `<a class="link-btn primary" href="/c/${encodeURIComponent(collectionId)}">Reset view</a>` : '')}
  </div>
</div>
`
}

function fitHref (baseUrl, fit, cols, rows, w, h) {
  if (!fit || !baseUrl) return ''
  let qs = '?lat=' + fit.lat.toFixed(6) +
    '&lon=' + fit.lon.toFixed(6) +
    '&zoom=' + fit.zoom +
    '&cols=' + cols +
    '&rows=' + rows
  if (Number.isFinite(w)) qs += '&w=' + w
  if (Number.isFinite(h)) qs += '&h=' + h
  return baseUrl + qs
}

function escapeText (s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function escapeAttr (s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// Embed a JSON string inside <script type="application/json">. The HTML
// parser only stops at "</script", so we just neutralize that sequence.
function escapeJsonForScript (s) {
  return String(s).replace(/<\/script/gi, '<\\/script')
}

function navFields (lat, lon, zoom, cols, rows, w, h) {
  let out = `<input type="hidden" name="lat" value="${lat}">
      <input type="hidden" name="lon" value="${lon}">
      <input type="hidden" name="zoom" value="${zoom}">
      <input type="hidden" name="cols" value="${cols}">
      <input type="hidden" name="rows" value="${rows}">`
  if (Number.isFinite(w)) out += `\n      <input type="hidden" name="w" value="${w}">`
  if (Number.isFinite(h)) out += `\n      <input type="hidden" name="h" value="${h}">`
  return out
}

function clampGrid (n, fallback) {
  if (!Number.isFinite(n)) return fallback
  return Math.max(3, Math.min(13, n))
}

function sizeAttr (raw) {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return s + 'px'
  return s
}

// True when an attribute means "hide". `null` / `undefined` / missing means
// "show" (default). Accepted hide values: "none", "false", "0", "hide", "off".
function isHidden (raw) {
  if (raw == null) return false
  const s = String(raw).trim().toLowerCase()
  return s === 'none' || s === 'false' || s === '0' || s === 'hide' || s === 'off'
}

function resolvePolyline (store, attrs) {
  const coords = store?.polylineCoordinates
  if (Array.isArray(coords) && coords.length > 0) return coords
  const encoded = attrs?.polyline
  if (typeof encoded !== 'string' || encoded.length === 0) return null
  const precision = parseInt(attrs['polyline-precision'], 10)
  try {
    return decodePolyline(encoded, Number.isFinite(precision) ? precision : 6)
  } catch (_e) {
    return null
  }
}
