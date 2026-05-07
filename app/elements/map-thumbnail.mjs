// <map-thumbnail lat="..." lon="..." zoom="..." width="160" height="100">
//
// Thin preset around <usgs-map> for static thumbnails / previews. Locks
// chrome="minimal" and no-script so it ships zero JS, and forces a fixed
// pixel size so the parent layout doesn't have to worry about height
// inheritance.
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

  return html`
<style scope="global">
  map-thumbnail { display: contents; }
  map-thumbnail .map-thumbnail-box {
    display: inline-block;
    vertical-align: middle;
    border: 1px solid var(--map-thumbnail-border, #cccccc);
    border-radius: var(--map-thumbnail-radius, 6px);
    overflow: hidden;
    line-height: 0;
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
