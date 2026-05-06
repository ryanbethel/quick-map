// <map-nav>
//
// Standalone pan / zoom / locate control panel. Two execution modes:
//
//   no-script              → 6 forms (pan N/E/S/W, zoom in/out) submit GET
//                            to `base-url` with hidden lat/lon/zoom inputs.
//                            (Geolocation requires JS, so the locate button
//                            is hidden in this mode.)
//   (default, progressive) → forms + script that intercepts submit and
//                            either (a) calls imperative methods on a
//                            target <usgs-map> when wired by `for=` or by
//                            being slotted inside one, or (b) dispatches
//                            `mapnav:action` for the consumer to handle.
//
// Three state-sharing patterns are supported:
//
//   A. Slotted inside <usgs-map>     → parent map intercepts via event
//                                       delegation; `<map-nav>` itself
//                                       only emits the bubbling submit /
//                                       custom event.
//   B. Sibling, same document        → `for="map-id"` looks up the target
//                                       and calls zoomIn/zoomOut/panBy.
//   C. Cross-frame iframe parent     → `target="iframe-name"` makes the
//                                       form submission land in the iframe.
//                                       Works without JS.

import { pixelToLatLon } from '../lib/tiles.mjs'

const PIXELS_PER_TILE = 256

export default function mapNav ({ html, state }) {
  const attrs = state?.attrs || {}
  const noScript = attrs['no-script'] != null
  const lat = parseFloat(attrs.lat)
  const lon = parseFloat(attrs.lon)
  const zoom = parseInt(attrs.zoom, 10)
  const cols = parseInt(attrs.cols, 10) || 7
  const rows = parseInt(attrs.rows, 10) || 7
  const baseUrl = attrs['base-url'] || ''
  const target = attrs.target || ''
  const forId = attrs.for || ''
  const showLocate = attrs.locate !== 'false'

  const haveState = Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(zoom)
  // Crosshair = the wrap-local pixel where the lat/lon center sits. Pan
  // deltas are measured from this point, not from the wrap's geometric
  // center — those differ by up to half a tile (the lat/lon's offset
  // inside its tile) and using stageX/Y instead would over-pan by exactly
  // that amount on the first click for any given center.
  const cross = haveState ? crosshairPixel(lat, lon, zoom, cols, rows) : null

  const navFields = (action) => {
    if (!haveState) return ''
    let next
    if (action === 'zoom-in') next = { lat, lon, zoom: Math.min(zoom + 1, 16) }
    else if (action === 'zoom-out') next = { lat, lon, zoom: Math.max(zoom - 1, 0) }
    else {
      let dx = 0, dy = 0
      if (action === 'pan-n') dy = -PIXELS_PER_TILE
      if (action === 'pan-s') dy = PIXELS_PER_TILE
      if (action === 'pan-w') dx = -PIXELS_PER_TILE
      if (action === 'pan-e') dx = PIXELS_PER_TILE
      const p = pixelToLatLon(cross.x + dx, cross.y + dy, zoom, lat, lon, cols, rows)
      next = { lat: p.lat, lon: p.lon, zoom }
    }
    return `
      <input type="hidden" name="lat" value="${next.lat.toFixed(6)}">
      <input type="hidden" name="lon" value="${next.lon.toFixed(6)}">
      <input type="hidden" name="zoom" value="${next.zoom}">
      <input type="hidden" name="cols" value="${cols}">
      <input type="hidden" name="rows" value="${rows}">`
  }

  const formAttrs = `${baseUrl ? ` action="${escapeAttr(baseUrl)}"` : ''} method="GET"${target ? ` target="${escapeAttr(target)}"` : ''}`

  const button = (cls, action, ariaLabel, glyph) => `
    <form class="map-nav-cell map-nav-${cls}" data-action="${action}"${formAttrs}>
      ${navFields(action)}
      <button type="submit" aria-label="${ariaLabel}">${glyph}</button>
    </form>`

  const locateBtn = !showLocate || noScript
    ? ''
    : `
    <form class="map-nav-cell map-nav-locate" data-action="locate">
      <button type="submit" aria-label="Find my location">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
          <path d="M229.33,98.21,53.41,33l-.16-.05A16,16,0,0,0,32.9,53.25a1,1,0,0,0,.05.16L98.21,229.33A15.77,15.77,0,0,0,113.28,240h.3a15.77,15.77,0,0,0,15-11.29l23.56-76.56,76.56-23.56a16,16,0,0,0,.62-30.38ZM224,113.3l-76.56,23.56a16,16,0,0,0-10.58,10.58L113.3,224h0l-.06-.17L48,48l175.82,65.22.16.06Z"/>
        </svg>
      </button>
    </form>`

  const panel = `
<div class="map-nav-panel" role="group" aria-label="Map controls">
  ${button('pan-n', 'pan-n', 'Pan north', '&#9650;')}
  ${button('pan-w', 'pan-w', 'Pan west', '&#9664;')}
  ${button('pan-e', 'pan-e', 'Pan east', '&#9654;')}
  ${button('pan-s', 'pan-s', 'Pan south', '&#9660;')}
  ${button('zoom-in', 'zoom-in', 'Zoom in', '+')}
  ${button('zoom-out', 'zoom-out', 'Zoom out', '&minus;')}
  ${locateBtn}
</div>`

  const script = noScript ? '' : renderScript({ forId, target })

  return html`
<style>
  :host {
    display: block;
  }
  .map-nav-panel {
    display: grid;
    grid-template-columns: var(--map-nav-cell, 36px) var(--map-nav-cell, 36px) var(--map-nav-cell, 36px);
    grid-template-rows: repeat(4, var(--map-nav-cell, 36px));
    gap: var(--map-nav-gap, 4px);
    padding: var(--map-nav-padding, 6px);
    background-color: var(--map-nav-bg, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--map-nav-border, #cccccc);
    border-radius: var(--map-nav-radius, 8px);
    box-shadow: var(--map-nav-shadow, 0 1px 4px rgba(0, 0, 0, 0.2));
    color: var(--map-nav-fg, #111111);
    width: max-content;
  }
  .map-nav-cell {
    margin: 0;
  }
  .map-nav-cell button {
    width: var(--map-nav-cell, 36px);
    height: var(--map-nav-cell, 36px);
    background-color: var(--map-nav-button-bg, #ffffff);
    color: var(--map-nav-button-fg, #111111);
    border: 1px solid var(--map-nav-button-border, #cccccc);
    border-radius: var(--map-nav-button-radius, 6px);
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-size: 16px;
  }
  .map-nav-cell button svg {
    width: 18px;
    height: 18px;
  }
  .map-nav-cell button:hover {
    background-color: var(--map-nav-button-hover-bg, #f2f2f2);
  }
  .map-nav-pan-n { grid-column: 2; grid-row: 1; }
  .map-nav-pan-w { grid-column: 1; grid-row: 2; }
  .map-nav-pan-e { grid-column: 3; grid-row: 2; }
  .map-nav-pan-s { grid-column: 2; grid-row: 3; }
  .map-nav-zoom-in { grid-column: 1; grid-row: 4; }
  .map-nav-zoom-out { grid-column: 3; grid-row: 4; }
  .map-nav-locate { grid-column: 2; grid-row: 4; }
</style>
${panel}
${script}
`
}

function renderScript ({ forId, target }) {
  return /*html*/`
<script type="module">
if (!customElements.get('map-nav')) {
  const FOR_ID = ${JSON.stringify(forId)}
  const TARGET = ${JSON.stringify(target)}
  const PIXELS_PER_TILE = 256
  const PAN_PX = PIXELS_PER_TILE
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

  // Local copy of pixelToLatLon — same math as the shared lib, inlined so the
  // element doesn't need an import map.
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

  // Wrap-local pixel position of the (lat, lon) center inside the grid.
  // Pan deltas are anchored here so a click pans by exactly PAN_PX.
  function crosshairPixel (lat, lon, zoom, cols, rows) {
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

  function findTargetMap (el) {
    const forId = el.getAttribute('for') || FOR_ID
    if (forId) {
      const target = document.getElementById(forId)
      if (target) return target
    }
    return el.closest('usgs-map')
  }

  function findTargetIframe (name) {
    if (!name) return null
    try { return document.querySelector('iframe[name="' + CSS.escape(name) + '"]') }
    catch { return document.getElementsByName(name)[0] || null }
  }

  class MapNav extends HTMLElement {
    connectedCallback () {
      this.lat = parseFloat(this.getAttribute('lat'))
      this.lon = parseFloat(this.getAttribute('lon'))
      this.zoom = parseInt(this.getAttribute('zoom'), 10)
      this.cols = parseInt(this.getAttribute('cols'), 10) || 7
      this.rows = parseInt(this.getAttribute('rows'), 10) || 7
      this.baseUrl = this.getAttribute('base-url') || ''
      this.targetName = this.getAttribute('target') || TARGET
      this.addEventListener('submit', e => this.onSubmit(e))

      // Sync state from the target map's map:move events when same-doc.
      // (Iframes own their own state; for those we update locally on click.)
      if (!this.targetName) {
        const map = findTargetMap(this)
        if (map) map.addEventListener('map:move', e => this.syncFromMove(e))
      }
    }

    syncFromMove (e) {
      const d = e.detail
      if (!d) return
      if (Number.isFinite(d.lat)) this.lat = d.lat
      if (Number.isFinite(d.lon)) this.lon = d.lon
      if (Number.isFinite(d.zoom)) this.zoom = d.zoom
    }

    haveState () {
      return Number.isFinite(this.lat) && Number.isFinite(this.lon) && Number.isFinite(this.zoom)
    }

    nextState (action) {
      if (action === 'zoom-in') return { lat: this.lat, lon: this.lon, zoom: clamp(this.zoom + 1, 0, 16) }
      if (action === 'zoom-out') return { lat: this.lat, lon: this.lon, zoom: clamp(this.zoom - 1, 0, 16) }
      let dx = 0, dy = 0
      if (action === 'pan-n') dy = -PAN_PX
      if (action === 'pan-s') dy = PAN_PX
      if (action === 'pan-w') dx = -PAN_PX
      if (action === 'pan-e') dx = PAN_PX
      const cross = crosshairPixel(this.lat, this.lon, this.zoom, this.cols, this.rows)
      const p = pixelToLatLon(cross.x + dx, cross.y + dy, this.zoom, this.lat, this.lon, this.cols, this.rows)
      return { lat: p.lat, lon: p.lon, zoom: this.zoom }
    }

    buildIframeUrl ({ lat, lon, zoom }) {
      const url = new URL(this.baseUrl || './', window.location.href)
      url.searchParams.set('lat', lat.toFixed(6))
      url.searchParams.set('lon', lon.toFixed(6))
      url.searchParams.set('zoom', String(zoom))
      url.searchParams.set('cols', String(this.cols))
      url.searchParams.set('rows', String(this.rows))
      url.searchParams.delete('fit')
      return url.pathname + url.search
    }

    async onSubmit (e) {
      const form = e.target.closest('form.map-nav-cell')
      if (!form) return
      e.preventDefault()
      const action = form.dataset.action
      this.dispatchEvent(new CustomEvent('mapnav:action', { bubbles: true, detail: { action } }))
      if (action === 'locate') return this.locate()
      if (!this.haveState()) return

      const next = this.nextState(action)

      if (this.targetName) {
        // Iframe-targeted: navigate the iframe imperatively so the URL we
        // send always reflects our up-to-date local state. (Letting the
        // form submit naturally would re-send the SSR'd hidden fields,
        // which never change after the first click.)
        const iframe = findTargetIframe(this.targetName)
        if (iframe) {
          const url = this.buildIframeUrl(next)
          try { iframe.contentWindow.location.assign(url) }
          catch { iframe.src = url }
        }
        Object.assign(this, next)
        return
      }

      // Same-document: drive the map via its imperative API. We sync our
      // state from map:move events the map dispatches in response.
      const map = findTargetMap(this)
      if (!map) {
        Object.assign(this, next)
        return
      }
      switch (action) {
      case 'zoom-in': map.zoomIn?.(); break
      case 'zoom-out': map.zoomOut?.(); break
      case 'pan-n': map.panBy?.(0, -PAN_PX); break
      case 'pan-s': map.panBy?.(0, PAN_PX); break
      case 'pan-w': map.panBy?.(-PAN_PX, 0); break
      case 'pan-e': map.panBy?.(PAN_PX, 0); break
      }
    }

    async locate () {
      if (!navigator.geolocation) return
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        })
        const detail = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        this.dispatchEvent(new CustomEvent('mapnav:locate', { bubbles: true, detail }))
        if (this.targetName) {
          const iframe = findTargetIframe(this.targetName)
          if (iframe && Number.isFinite(this.zoom)) {
            const url = this.buildIframeUrl({ lat: detail.lat, lon: detail.lon, zoom: this.zoom })
            try { iframe.contentWindow.location.assign(url) }
            catch { iframe.src = url }
            this.lat = detail.lat
            this.lon = detail.lon
          }
          return
        }
        const map = findTargetMap(this)
        if (map?.setView) map.setView(detail)
      } catch (err) {
        this.dispatchEvent(new CustomEvent('mapnav:error', { bubbles: true, detail: { error: err.message } }))
      }
    }
  }
  customElements.define('map-nav', MapNav)
}
</script>`
}

function escapeAttr (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// Wrap-local pixel position of the (lat, lon) center inside an N x M grid.
// Same math the server-rendered tile grid and <usgs-map> use to place the
// crosshair; pan/zoom deltas should be measured from this point.
function crosshairPixel (lat, lon, zoom, cols, rows) {
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
