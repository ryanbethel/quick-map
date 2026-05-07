// <map-thumbnail lat="..." lon="..." zoom="..." width="160" height="100" pin="true">
//
// Thin preset around <usgs-map> for static thumbnails / previews. Locks
// chrome="minimal" and no-script so it ships zero JS, and forces a fixed
// pixel size so the parent layout doesn't have to worry about height
// inheritance.
//
// Optional `pin="true"` overlays a center pin marker — handy for previews
// that represent a single point (e.g. a trailhead or address). The marker
// is purely decorative and pointer-events: none, so it doesn't interfere
// with click handlers on the host element. Use slotted <map-pin> children
// if you need projected, multi-point pins instead.
//
// Authoring note: hf-maps' SSR runs in flat-DOM (no Shadow DOM), so any
// per-instance CSS value baked into a `<style>` block leaks across every
// instance via the Enhance global stylesheet — the LAST instance wins.
// All static rules live in `<style scope="global">` with explicit element-
// name selectors; per-instance values (width/height) ride on the inner
// wrapper's inline `style` attribute and never enter the stylesheet.

export default function mapThumbnail ({ html, state }) {
  const attrs = state?.attrs || {}
  const width = sizeAttr(attrs.width) || '160px'
  const height = sizeAttr(attrs.height) || '100px'
  const lat = attrs.lat || ''
  const lon = attrs.lon || ''
  const zoom = attrs.zoom || ''
  const cols = attrs.cols || '3'
  const rows = attrs.rows || '3'
  const showPin = attrs.pin != null && attrs.pin !== 'false' && attrs.pin !== '0'

  return html`
<style scope="global">
  map-thumbnail { display: contents; }
  map-thumbnail .map-thumbnail-box {
    position: relative;
    display: inline-block;
    vertical-align: middle;
    border: 1px solid var(--map-thumbnail-border, #cccccc);
    border-radius: var(--map-thumbnail-radius, 6px);
    overflow: hidden;
    line-height: 0;
  }
  map-thumbnail .map-thumbnail-pin {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--map-thumbnail-pin-size, 24px);
    height: var(--map-thumbnail-pin-size, 24px);
    /* Anchor at the bottom-center of the SVG so the pin's tip lines up
       with the geometric center of the box (= the lat/lon center). */
    transform: translate(-50%, -100%);
    color: var(--map-thumbnail-pin-color, #d62828);
    pointer-events: none;
    filter: var(--map-thumbnail-pin-shadow, drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)));
    z-index: 5;
  }
  map-thumbnail .map-thumbnail-pin svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>

<div class="map-thumbnail-box" style="width: ${escapeAttr(width)}; height: ${escapeAttr(height)};">
  <usgs-map
    lat="${escapeAttr(lat)}"
    lon="${escapeAttr(lon)}"
    zoom="${escapeAttr(zoom)}"
    cols="${escapeAttr(cols)}"
    rows="${escapeAttr(rows)}"
    chrome="minimal"
    no-script>
    <slot></slot>
  </usgs-map>
  ${showPin ? `<span class="map-thumbnail-pin" aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
    </svg>
  </span>` : ''}
</div>
`
}

function sizeAttr (raw) {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return s + 'px'
  return s
}

function escapeAttr (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
