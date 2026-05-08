// <map-pin lat="..." lon="..." name="..." note="..." index="...">
//
// Renders a pin overlay positioned by Web-Mercator projection inside its
// parent <usgs-map>. Reads geometry from `state.store` (centerLat/Lon/zoom,
// gridCols/Rows) which is set by the map's API handler.
//
// Pure server-rendered; the only JS is whatever the parent <usgs-map>
// installs (popover-close coordination). Theme via CSS variables —
// see map-pin.md.

import { latLonToGridPixel } from '../browser/tiles.mjs'

export default function mapPin({ html, state }) {
  const attrs = state?.attrs || {}
  const store = state?.store || {}

  const lat = parseFloat(attrs.lat)
  const lon = parseFloat(attrs.lon)
  const name = attrs.name || ''
  const note = attrs.note || ''
  const index = attrs.index != null && attrs.index !== '' ? parseInt(attrs.index, 10) : null

  const centerLat = parseFloat(store.centerLat)
  const centerLon = parseFloat(store.centerLon)
  const zoom = parseInt(store.zoom, 10)
  const mode = store.collectionMode || 'view'
  const collectionId = store.collectionId || ''
  const gridCols = store.gridCols || 5
  const gridRows = store.gridRows || 5

  if (
    !Number.isFinite(lat) || !Number.isFinite(lon) ||
    !Number.isFinite(centerLat) || !Number.isFinite(centerLon) ||
    !Number.isFinite(zoom)
  ) {
    return html``
  }

  const { x, y } = latLonToGridPixel(lat, lon, zoom, centerLat, centerLon, gridCols, gridRows)
  const totalW = gridCols * 256
  const totalH = gridRows * 256
  const margin = 32
  if (x < -margin || y < -margin || x > totalW + margin || y > totalH + margin) {
    return html``
  }

  const recenterHref = mode === 'view' && collectionId
    ? `/c/${collectionId}?lat=${lat}&lon=${lon}&zoom=${zoom}`
    : ''

  return html`
<style scope="global">
  map-pin {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  map-pin .map-pin-anchor {
    position: absolute;
    transform: translate(-50%, -100%);
    pointer-events: auto;
    z-index: 10;
  }

  map-pin .map-pin-anchor details {
    position: relative;
  }

  map-pin .map-pin-anchor summary {
    list-style: none;
    cursor: pointer;
    color: var(--map-pin-color, #1a73e8);
    display: block;
    width: var(--map-pin-size, 28px);
    height: var(--map-pin-size, 28px);
  }

  map-pin .map-pin-anchor summary::-webkit-details-marker {
    display: none;
  }

  map-pin .map-pin-anchor summary svg {
    width: 100%;
    height: 100%;
    filter: var(--map-pin-shadow, drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)));
  }

  map-pin .map-pin-anchor details[open] summary svg {
    color: var(--map-pin-color-open, #d62828);
  }

  map-pin .map-pin-info {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 180px;
    max-width: 260px;
    padding: var(--map-pin-info-padding, 8px 10px);
    background-color: var(--map-pin-info-bg, rgba(255, 255, 255, 0.98));
    border: 1px solid var(--map-pin-info-border, #cccccc);
    border-radius: var(--map-pin-info-radius, 6px);
    box-shadow: var(--map-pin-info-shadow, 0 2px 8px rgba(0, 0, 0, 0.25));
    color: var(--map-pin-info-fg, #111111);
    font: var(--map-pin-info-font, 13px/1.35 system-ui, sans-serif);
  }

  map-pin .map-pin-info::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--map-pin-info-bg, rgba(255, 255, 255, 0.98));
  }

  map-pin .map-pin-info h3 {
    font-size: 14px;
    margin: 0 0 4px 0;
  }

  map-pin .map-pin-info p {
    margin: 0 0 4px 0;
    color: var(--map-pin-info-fg, #333333);
  }

  map-pin .map-pin-info .map-pin-coords {
    color: #666666;
    font-size: 11px;
  }

  map-pin .map-pin-info .map-pin-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    flex-wrap: wrap;
    margin-top: 6px;
  }

  map-pin .map-pin-info form {
    margin: 0;
  }

  map-pin .map-pin-info button,
  map-pin .map-pin-info a {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    background-color: var(--map-pin-button-bg, #ffffff);
    color: var(--map-pin-button-fg, #111111);
    border: 1px solid var(--map-pin-button-border, #cccccc);
    border-radius: 9999px;
    font: inherit;
    font-size: 12px;
    text-decoration: none;
    cursor: pointer;
  }

  map-pin .map-pin-info button.map-pin-danger {
    color: var(--map-pin-danger-fg, #b3261e);
    border-color: var(--map-pin-danger-fg, #b3261e);
  }
</style>

<div class="map-pin-anchor" style="left: ${x.toFixed(1)}px; top: ${y.toFixed(1)}px;">
  <details>
    <summary aria-label="${escapeAttr(name || 'Map pin')}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
      </svg>
    </summary>
    <div class="map-pin-info" role="dialog" aria-label="${escapeAttr(name || 'Pin details')}">
      ${name ? `<h3>${escapeText(name)}</h3>` : ''}
      ${note ? `<p>${escapeText(note)}</p>` : ''}
      <p class="map-pin-coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
      <div class="map-pin-actions">
        ${recenterHref ? `<a href="${recenterHref}">Center here</a>` : ''}
        ${mode === 'create' && index != null ? `
          <form action="/c/new/remove" method="POST">
            <input type="hidden" name="index" value="${index}">
            <button type="submit" class="map-pin-danger">Remove</button>
          </form>
        ` : ''}
      </div>
    </div>
  </details>
</div>
`
}

function escapeText(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
