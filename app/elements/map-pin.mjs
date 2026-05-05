import { latLonToGridPixel } from '../lib/tiles.mjs'

export default function mapPin ({ html, state }) {
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
<style>
  :host {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .pin-anchor {
    position: absolute;
    transform: translate(-50%, -100%);
    pointer-events: auto;
    z-index: 10;
  }

  details {
    position: relative;
  }

  summary {
    list-style: none;
    cursor: pointer;
    color: #1a73e8;
    display: block;
    width: 28px;
    height: 28px;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary svg {
    width: 28px;
    height: 28px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  details[open] summary svg {
    color: #d62828;
  }

  .pin-info {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 180px;
    max-width: 260px;
    padding: 8px 10px;
    background-color: rgba(255, 255, 255, 0.98);
    border: 1px solid #cccccc;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    color: #111111;
    font-size: 13px;
    line-height: 1.35;
  }

  .pin-info::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(255, 255, 255, 0.98);
  }

  .pin-info h3 {
    font-size: 14px;
    margin: 0 0 4px 0;
  }

  .pin-info p {
    margin: 0 0 4px 0;
    color: #333333;
  }

  .pin-info .coords {
    color: #666666;
    font-size: 11px;
  }

  .pin-info .pin-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    flex-wrap: wrap;
    margin-top: 6px;
  }

  .pin-info form {
    margin: 0;
  }

  .pin-info button,
  .pin-info a {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
    border-radius: 9999px;
    font: inherit;
    font-size: 12px;
    text-decoration: none;
    cursor: pointer;
  }

  .pin-info button.danger {
    color: #b3261e;
    border-color: #b3261e;
  }
</style>

<div class="pin-anchor" style="left: ${x.toFixed(1)}px; top: ${y.toFixed(1)}px;">
  <details>
    <summary aria-label="${escapeAttr(name || 'Map pin')}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
      </svg>
    </summary>
    <div class="pin-info" role="dialog" aria-label="${escapeAttr(name || 'Pin details')}">
      ${name ? `<h3>${escapeText(name)}</h3>` : ''}
      ${note ? `<p>${escapeText(note)}</p>` : ''}
      <p class="coords">${lat.toFixed(5)}, ${lon.toFixed(5)}</p>
      <div class="pin-actions">
        ${recenterHref ? `<a href="${recenterHref}">Center here</a>` : ''}
        ${mode === 'create' && index != null ? `
          <form action="/c/new/remove" method="POST">
            <input type="hidden" name="index" value="${index}">
            <button type="submit" class="danger">Remove</button>
          </form>
        ` : ''}
      </div>
    </div>
  </details>
</div>
`
}

function escapeText (s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

function escapeAttr (s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
