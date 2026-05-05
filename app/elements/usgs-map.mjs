// <usgs-map> — server-rendered point-collection map.
//
// Reads its config from `state.store` so any page hosting it can hydrate it:
//
//   centerLat, centerLon : number  - current view center
//   zoom                 : number  - integer Web-Mercator zoom (0..16)
//   collectionMode       : string  - "view" (default) or "create"
//   collectionId         : string  - id used to build form actions in view mode
//   collectionTitle      : string  - optional, rendered in the info panel
//   gridCols, gridRows   : number  - tile grid size (default 5x5)
//   draftPinCount        : number  - in create mode, current draft length
//   flash                : string  - optional flash message
//
// Children (`<map-pin>` elements) are rendered into the slot and read the same
// store to position themselves.
//
// P1 ships a fully no-JS baseline: zoom buttons, N/E/S/W pan nudges, address
// search, and (in create mode) an "add pin at center" form + save form. The
// trailing <script> is reserved for P2+ enhancements (drag-to-pan, click-to-add,
// pinch-zoom, popover tooltip).

import { buildTileGrid, pixelToLatLon } from '../lib/tiles.mjs'

const FULL_TILE = 256

export default function usgsMap ({ html, state }) {
  const store = state?.store || {}
  const centerLat = parseFloat(store.centerLat)
  const centerLon = parseFloat(store.centerLon)
  const zoomRaw = parseInt(store.zoom, 10)
  const zoom = Number.isFinite(zoomRaw) ? Math.max(0, Math.min(16, zoomRaw)) : 10
  const mode = store.collectionMode === 'create' ? 'create' : 'view'
  const collectionId = store.collectionId || ''
  const title = store.collectionTitle || ''
  const draftPinCount = Number.isFinite(parseInt(store.draftPinCount, 10))
    ? parseInt(store.draftPinCount, 10) : 0
  const flash = store.flash || ''
  // chrome="minimal" hides controls/info-panel/crosshair — used when the
  // map is embedded as a preview surface.
  const minimal = store.chrome === 'minimal'
  // Defaults of 7x7 (1792x1792 px) cover most laptop viewports without
  // gray bars; the client-side enhancement may navigate to a different size
  // based on actual viewport dimensions.
  const gridCols = clampGrid(parseInt(store.gridCols, 10), 7)
  const gridRows = clampGrid(parseInt(store.gridRows, 10), 7)
  // Iframe pixel dimensions, when the client provided them. Threaded into
  // fit/nav links so subsequent navigations keep using the right visible
  // window for bbox-fit math.
  const viewW = Number.isFinite(parseInt(store.viewW, 10)) ? parseInt(store.viewW, 10) : null
  const viewH = Number.isFinite(parseInt(store.viewH, 10)) ? parseInt(store.viewH, 10) : null
  // Optional best-fit center+zoom for the current pin set, computed by the
  // page handler. Drives the "Fit pins" button.
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

  const grid = buildTileGrid({
    latitude: centerLat,
    longitude: centerLon,
    zoom,
    rows: gridRows,
    cols: gridCols
  })

  const baseUrl = mode === 'create' ? '/c/new' : `/c/${encodeURIComponent(collectionId)}`

  // Stage center = geometric center of the wrap = where the crosshair sits in
  // screen space. Using this (rather than the lat/lon center, which can be
  // anywhere within the center tile) makes pan distances consistent and means
  // every nudge / drag-release lands at a stable sub-tile offset of 128. After
  // the first interaction, no visual jumps on subsequent ones.
  const stageCenterX = (gridCols * 256) / 2
  const stageCenterY = (gridRows * 256) / 2

  // The lat/lon center sits at wrap-local (centerCol*256 + offset.x, ...) which
  // can be up to 128 px off the wrap's geometric center. In preview mode (no
  // pointer interactions) we offset the wrap so the lat/lon center lands at
  // the visual viewport center — pins stay centered in the iframe instead of
  // drifting to one side. Editor mode skips this so it doesn't fight the JS
  // drag/pinch transforms; once the user pans, snap-to-tile keeps it aligned.
  const centerCol = Math.floor((gridCols - 1) / 2)
  const centerRow = Math.floor((gridRows - 1) / 2)
  const wrapShiftX = minimal ? Math.round(stageCenterX - (centerCol * 256 + grid.offset.x)) : 0
  const wrapShiftY = minimal ? Math.round(stageCenterY - (centerRow * 256 + grid.offset.y)) : 0

  // Each nav form ships its target lat/lon/zoom (and cols/rows) as hidden
  // inputs so a browser's GET-form behavior — which replaces the action URL's
  // query string with the form fields — round-trips correctly. If we baked
  // the params into the action URL alone, submitting the form would strip
  // them.
  const nudgeFields = (dx, dy) => {
    const { lat, lon } = pixelToLatLon(stageCenterX + dx, stageCenterY + dy, zoom, centerLat, centerLon, gridCols, gridRows)
    return navFields(lat.toFixed(6), lon.toFixed(6), zoom, gridCols, gridRows, viewW, viewH)
  }

  const zoomInFields = navFields(centerLat, centerLon, Math.min(zoom + 1, 16), gridCols, gridRows, viewW, viewH)
  const zoomOutFields = navFields(centerLat, centerLon, Math.max(zoom - 1, 0), gridCols, gridRows, viewW, viewH)

  return html`
<style>
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    background-color: #e8e8e8;
  }

  .map-stage {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map-grid-wrap {
    position: relative;
    width: ${gridCols * 256}px;
    height: ${gridRows * 256}px;
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

  .center-crosshair {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 18px;
    height: 18px;
    margin-left: -9px;
    margin-top: -9px;
    border: 2px solid rgba(0, 0, 0, 0.55);
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
    pointer-events: none;
    z-index: 25;
  }

  .map-scale {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background-color: rgba(255, 255, 255, 0.85);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    color: #111111;
  }

  .panel {
    position: absolute;
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid #cccccc;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    color: #111111;
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
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
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
    background-color: #f2f2f2;
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
    max-width: calc(100dvw - 24px);
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
    color: #444444;
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
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
    border-radius: 4px;
    font: inherit;
  }

  .info-panel button {
    height: 30px;
    padding: 0 12px;
    border-radius: 9999px;
    border: 1px solid #cccccc;
    background-color: #ffffff;
    color: #111111;
    font: inherit;
    cursor: pointer;
  }

  .info-panel button.primary,
  .info-panel a.link-btn.primary {
    background-color: #0066ff;
    color: #ffffff;
    border-color: #0066ff;
  }

  .info-panel a.link-btn {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border-radius: 9999px;
    border: 1px solid #cccccc;
    background-color: #ffffff;
    color: #111111;
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
    max-width: 90dvw;
    padding: 8px 14px;
    background-color: #ffe9c2;
    color: #5b3a00;
    border: 1px solid #d4a64a;
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }

  .map-error {
    padding: 16px;
    color: #b3261e;
  }

  .add-pin-dialog {
    border: 1px solid #cccccc;
    border-radius: 8px;
    padding: 16px;
    min-width: 280px;
    max-width: 360px;
    color: #111111;
    background-color: #ffffff;
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
    color: #444444;
  }

  .add-pin-dialog input[type="text"] {
    height: 32px;
    padding: 0 8px;
    border: 1px solid #cccccc;
    border-radius: 4px;
    font: inherit;
    background-color: #ffffff;
    color: #111111;
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
    border: 1px solid #cccccc;
    background-color: #ffffff;
    color: #111111;
    font: inherit;
    cursor: pointer;
  }

  .add-pin-dialog button.primary {
    background-color: #0066ff;
    color: #ffffff;
    border-color: #0066ff;
  }
</style>

<div class="map-stage">
  <div class="map-grid-wrap"
       data-center-lat="${centerLat}"
       data-center-lon="${centerLon}"
       data-zoom="${zoom}"
       data-grid-cols="${gridCols}"
       data-grid-rows="${gridRows}"
       data-mode="${mode}"
       data-chrome="${minimal ? 'minimal' : 'full'}"
       data-collection-id="${escapeAttr(collectionId)}"${(wrapShiftX || wrapShiftY) ? ` style="transform: translate(${wrapShiftX}px, ${wrapShiftY}px)"` : ''}>
    <div class="map-grid">
      ${grid.mapTileGrid.map(row => row.map(cell => `
        <div class="tile-container">
          <img class="map-tile" src="${cell.tileUrl}" loading="lazy" width="256" height="256" alt="">
        </div>
      `).join('')).join('')}
    </div>

    <slot></slot>
  </div>

  ${minimal ? '' : '<div class="center-crosshair" aria-hidden="true"></div>'}

  <div class="map-scale" aria-hidden="true">${(grid.scale * 50).toFixed(2)} km</div>

  ${minimal ? '' : `
  <div class="panel controls" role="group" aria-label="Map controls">
    <form action="${baseUrl}" method="GET" class="nudge-n">
      ${nudgeFields(0, -FULL_TILE)}
      <button type="submit" aria-label="Pan north">&#9650;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="nudge-w">
      ${nudgeFields(-FULL_TILE, 0)}
      <button type="submit" aria-label="Pan west">&#9664;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="nudge-e">
      ${nudgeFields(FULL_TILE, 0)}
      <button type="submit" aria-label="Pan east">&#9654;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="nudge-s">
      ${nudgeFields(0, FULL_TILE)}
      <button type="submit" aria-label="Pan south">&#9660;</button>
    </form>
    <form action="${baseUrl}" method="GET" class="zoom-in">
      ${zoomInFields}
      <button type="submit" aria-label="Zoom in">+</button>
    </form>
    <form action="${baseUrl}" method="GET" class="zoom-out">
      ${zoomOutFields}
      <button type="submit" aria-label="Zoom out">&minus;</button>
    </form>
  </div>`}

  ${minimal ? '' : (mode === 'create'
    ? renderCreatorPanel({ centerLat, centerLon, zoom, draftPinCount, fit, fitHref: fitHref(baseUrl, fit, gridCols, gridRows, viewW, viewH) })
    : renderViewerPanel({ title, collectionId, fit, fitHref: fitHref(baseUrl, fit, gridCols, gridRows, viewW, viewH) }))}

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

<script type="module">
if (!customElements.get('usgs-map')) {
  const PIXELS_PER_TILE = 256
  const DRAG_THRESHOLD = 5
  const SNAP_MS = 130
  const PINCH_ZOOM_IN = 1.5
  const PINCH_ZOOM_OUT = 1 / 1.5
  const RESIZE_DEBOUNCE_MS = 600
  // Editor needs a few tiles of headroom for drag/pinch; the preview is
  // static so it can shrink the wrap to fit the iframe and let the bbox-fit
  // math (which assumes wrap == visible) actually hold.
  const MIN_GRID_EDITOR = 5
  const MIN_GRID_PREVIEW = 3
  const MAX_GRID = 13

  // Inverse Mercator: wrap-local pixel back to lat/lon. Mirrors
  // app/lib/tiles.mjs::pixelToLatLon — kept inline so the element has no
  // external runtime deps.
  function pixelToLatLon (px, py, zoom, centerLat, centerLon, gridCols, gridRows) {
    const n = Math.pow(2, zoom)
    const total = n * PIXELS_PER_TILE
    const sinLat = Math.sin((centerLat * Math.PI) / 180)
    const centerX = ((centerLon + 180) / 360) * total
    const centerY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * total
    const centerCol = Math.floor((gridCols - 1) / 2)
    const centerRow = Math.floor((gridRows - 1) / 2)
    const offX = centerX - Math.floor(centerX / PIXELS_PER_TILE) * PIXELS_PER_TILE
    const offY = centerY - Math.floor(centerY / PIXELS_PER_TILE) * PIXELS_PER_TILE
    const centerGridX = centerCol * PIXELS_PER_TILE + offX
    const centerGridY = centerRow * PIXELS_PER_TILE + offY
    const tx = centerX + (px - centerGridX)
    const ty = centerY + (py - centerGridY)
    const lon = (tx / total) * 360 - 180
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / total))) * 180 / Math.PI
    return { lat, lon }
  }

  // Forward Mercator helper: lat/lon -> global Web-Mercator pixel at given zoom.
  function latLonToGlobal (lat, lon, zoom) {
    const total = Math.pow(2, zoom) * PIXELS_PER_TILE
    const sinLat = Math.sin((lat * Math.PI) / 180)
    return {
      x: ((lon + 180) / 360) * total,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * total
    }
  }

  function globalToLatLon (x, y, zoom) {
    const total = Math.pow(2, zoom) * PIXELS_PER_TILE
    const lon = (x / total) * 360 - 180
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / total))) * 180 / Math.PI
    return { lat, lon }
  }

  // Snap to nearest tile boundary so the new render's tile offset matches
  // the visual transform at release — eliminates the post-navigate jump.
  const snap = v => Math.round(v / PIXELS_PER_TILE) * PIXELS_PER_TILE
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

  // Optimal grid size for a viewport. +1 tile of buffer beyond what the
  // viewport actually covers gives drag headroom (editor) and prevents the
  // wrap edge from being exposed when wrapShift centers the lat/lon on the
  // iframe. We force odd col/row counts so wrapShift stays within ±128 px
  // (half a tile) — even-sized grids would let it slide a full tile and
  // expose the wrap's edge as a gray border. Preview/minimal mode uses a
  // smaller floor since it doesn't need drag headroom.
  function optimalGrid (minimal) {
    const min = minimal ? MIN_GRID_PREVIEW : MIN_GRID_EDITOR
    let cols = Math.ceil(window.innerWidth / PIXELS_PER_TILE) + 1
    let rows = Math.ceil(window.innerHeight / PIXELS_PER_TILE) + 1
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
      this.stageX = (this.gridCols * PIXELS_PER_TILE) / 2
      this.stageY = (this.gridRows * PIXELS_PER_TILE) / 2

      // Pointer/gesture state.
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
      // After a 2-pointer pinch ends, the surviving pointer must NOT spawn a
      // new drag — track it as residual until released.
      this.residualPointers = new Set()

      this.onDown = this.onDown.bind(this)
      this.onMove = this.onMove.bind(this)
      this.onUp = this.onUp.bind(this)
      this.onCancel = this.onCancel.bind(this)
      this.onDblClick = this.onDblClick.bind(this)
      this.onKeydown = this.onKeydown.bind(this)
      this.onDocClick = this.onDocClick.bind(this)
      this.onResize = this.onResize.bind(this)

      // Drag/pinch/dblclick are pointless in preview mode (server ignores
      // their navigations), so don't attach the gesture handlers there.
      if (!this.minimal) {
        this.wrap.addEventListener('pointerdown', this.onDown)
        this.wrap.addEventListener('pointermove', this.onMove)
        this.wrap.addEventListener('pointerup', this.onUp)
        this.wrap.addEventListener('pointercancel', this.onCancel)
        this.wrap.addEventListener('dblclick', this.onDblClick)
        this.wrap.style.cursor = ''
      } else {
        // Make it visually obvious the preview isn't interactive.
        this.wrap.style.cursor = 'default'
      }
      document.addEventListener('keydown', this.onKeydown)
      document.addEventListener('click', this.onDocClick)

      this.dialog = this.querySelector('.add-pin-dialog')
      this.installPinPopovers()
      this.installResizeHandling()
    }

    disconnectedCallback () {
      document.removeEventListener('keydown', this.onKeydown)
      document.removeEventListener('click', this.onDocClick)
      window.removeEventListener('resize', this.onResize)
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
    }

    // ─── Pin popover enhancements ──────────────────────────────────────
    installPinPopovers () {
      // Each <map-pin> wraps its info in a <details>; when one opens, close
      // the others so we never have a stack of overlapping bubbles.
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

    // ─── Resize handling ───────────────────────────────────────────────
    installResizeHandling () {
      // Initial measurement: if the SSR grid is too small for the viewport,
      // re-navigate at the optimal size. The default 7x7 covers most laptops,
      // so this usually no-ops on first load.
      const { cols, rows } = optimalGrid(this.minimal)
      if (cols !== this.gridCols || rows !== this.gridRows) {
        // Defer one tick so a click that triggered the navigate completes.
        Promise.resolve().then(() => this.navigate(this.centerLat, this.centerLon, this.zoom, cols, rows))
        return
      }
      window.addEventListener('resize', this.onResize)
    }

    onResize () {
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        if (!this.canAutoNavigate()) return
        const { cols, rows } = optimalGrid(this.minimal)
        if (cols === this.gridCols && rows === this.gridRows) return
        this.navigate(this.centerLat, this.centerLon, this.zoom, cols, rows)
      }, RESIZE_DEBOUNCE_MS)
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
      // Don't hijack pointer-downs on pins, controls, or any focusable child.
      if (e.target.closest('map-pin, button, a, input, summary, details, form, dialog')) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      // Two pointers down → start a pinch (cancel any in-progress drag).
      if (this.pointers.size === 2 && !this.pinching) {
        this.cancelDrag()
        this.startPinch()
        return
      }

      // First pointer → start a drag (unless it's a residual from a pinch).
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
        this.wrap.style.transform = 'translate(' + this.dx + 'px, ' + this.dy + 'px)'
      }
    }

    onUp (e) {
      const wasInPointers = this.pointers.has(e.pointerId)
      this.pointers.delete(e.pointerId)
      this.residualPointers.delete(e.pointerId)

      if (this.pinching) {
        // Pinch ends as soon as we drop below 2 active pointers.
        if (this.pointers.size < 2) {
          // Anything still down belongs to the pinch and shouldn't trigger
          // a new drag once it's released.
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
        const sx = snap(dx)
        const sy = snap(dy)
        this.animating = true
        this.wrap.classList.add('snapping')
        this.wrap.style.transform = 'translate(' + sx + 'px, ' + sy + 'px)'
        setTimeout(() => {
          if (sx === 0 && sy === 0) {
            this.wrap.classList.remove('snapping')
            this.wrap.style.transform = ''
            this.animating = false
            return
          }
          const next = pixelToLatLon(
            this.stageX - sx, this.stageY - sy,
            this.zoom, this.centerLat, this.centerLon,
            this.gridCols, this.gridRows
          )
          this.navigate(next.lat, next.lon, this.zoom)
        }, SNAP_MS)
        return
      }

      // Click (no drag). In create mode, open the add-pin dialog.
      if (wasClick && this.mode === 'create') {
        const rect = this.wrap.getBoundingClientRect()
        const px = clientX - rect.left
        const py = clientY - rect.top
        const { lat, lon } = pixelToLatLon(px, py, this.zoom, this.centerLat, this.centerLon, this.gridCols, this.gridRows)
        this.openAddPinDialog(lat, lon)
      }
      this.wrap.style.transform = ''
    }

    cancelDrag () {
      if (!this.dragging) return
      this.dragging = false
      this.dragPointerId = null
      this.dx = 0
      this.dy = 0
      this.wrap.classList.remove('dragging')
      this.wrap.classList.remove('snapping')
      this.wrap.style.transform = ''
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
        dist,
        midX,
        midY,
        rectLeft: rect.left,
        rectTop: rect.top,
        // Scale around the pinch midpoint in wrap-local coords. Setting
        // transform-origin per gesture keeps the math simple.
        localX: midX - rect.left,
        localY: midY - rect.top
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
      this.wrap.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + s + ')'
    }

    endPinch () {
      const s = this.pinchScale
      let zoomDelta = 0
      if (s >= PINCH_ZOOM_IN) zoomDelta = 1
      else if (s <= PINCH_ZOOM_OUT) zoomDelta = -1

      if (zoomDelta === 0) {
        // Not enough scale change — animate back and stay put.
        this.wrap.classList.add('snapping')
        this.wrap.style.transform = ''
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
      // Compute the lat/lon that was under the pinch midpoint at start, then
      // pick a new center that keeps that lat/lon at the same screen position
      // after the zoom changes.
      const px = this.pinchStart.localX
      const py = this.pinchStart.localY
      const L = pixelToLatLon(px, py, this.zoom, this.centerLat, this.centerLon, this.gridCols, this.gridRows)

      const Lglobal = latLonToGlobal(L.lat, L.lon, newZoom)
      const screenCenterX = this.pinchStart.rectLeft + this.stageX
      const screenCenterY = this.pinchStart.rectTop + this.stageY
      const offX = this.pinchStart.midX - screenCenterX
      const offY = this.pinchStart.midY - screenCenterY
      // At the new zoom, screen pixels and global Mercator pixels are 1:1.
      let Cx = Lglobal.x - offX
      let Cy = Lglobal.y - offY
      // Snap so the renderer puts the new center at exactly stageCenter
      // (sub-tile offset 128) — pixel-aligned with no post-load jump.
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
      this.wrap.style.transform = ''
      this.wrap.style.transformOrigin = ''
    }

    // ─── Double-click to zoom in (mouse only; create mode keeps click=add) ─
    onDblClick (e) {
      if (this.mode === 'create') return
      if (e.target.closest('map-pin, button, a, input, summary, details, form, dialog')) return
      if (this.zoom >= 16) return
      const rect = this.wrap.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const { lat, lon } = pixelToLatLon(px, py, this.zoom, this.centerLat, this.centerLon, this.gridCols, this.gridRows)
      this.navigate(lat, lon, this.zoom + 1)
    }

    // ─── Navigation ────────────────────────────────────────────────────
    // Build the new URL from the current location so any extra query params
    // (e.g. ?preview=1) are preserved automatically. This also means the
    // element doesn't have to know which route it's mounted on.
    navigate (lat, lon, zoom, cols, rows) {
      const c = cols || this.gridCols
      const r = rows || this.gridRows
      const url = new URL(window.location.href)
      url.searchParams.set('lat', lat.toFixed(6))
      url.searchParams.set('lon', lon.toFixed(6))
      url.searchParams.set('zoom', String(zoom))
      url.searchParams.set('cols', String(c))
      url.searchParams.set('rows', String(r))
      // Pass actual viewport pixel dims so the server's bbox-fit knows the
      // visible area (the wrap is intentionally bigger than the iframe).
      url.searchParams.set('w', String(window.innerWidth))
      url.searchParams.set('h', String(window.innerHeight))
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
</script>
`
}

function renderCreatorPanel ({ centerLat, centerLon, zoom, draftPinCount, fitHref }) {
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
  if (!fit) return ''
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
  // Lower bound is 3 so the preview iframe (no drag headroom needed) can
  // shrink the wrap to roughly match its viewport. The editor's client
  // floor of 5 still keeps a buffer for drag/pinch.
  return Math.max(3, Math.min(13, n))
}
