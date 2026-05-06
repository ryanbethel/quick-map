// <map-scale zoom="..." lat="..." width="80" units="dual" no-script>
//
// Server-rendered scale bar for a Web-Mercator tile map. With JS the inline
// script registers a Custom Element class that re-runs the same nice-round
// math when `lat`, `zoom`, `width`, or `units` change and replaces the span
// content in place — no roundtrip. With JS off, every value swap requires a
// new SSR. Pass `no-script` to suppress the inline script.
//
// Picks a "nice" 1-2-5 round value (1, 2, 5, 10, 20, 50, 100, ...) that fits
// in the requested max width, draws a bar of the corresponding pixel length,
// and adds inner tick marks. Defaults to a stacked dual-unit display
// (km + mi).
//
// Attributes:
//   zoom    : Web-Mercator zoom (0-16). Required.
//   lat     : center latitude. Optional but recommended (cosine correction).
//   width   : MAX bar width in px. Default 80. The actual rendered bar is
//             usually shorter — it's whatever the nice round number requires.
//   units   : "dual" (default), "km", or "mi". `dual` shows two stacked bars.
//   no-script : (boolean) skip the inline enhancement script.
//
// CSS variables:
//   --map-scale-bg, --map-scale-fg, --map-scale-border-radius,
//   --map-scale-padding, --map-scale-font, --map-scale-line, --map-scale-gap.

import { computeScale, renderInnerHTML, hostMaxWidthStyle } from '../browser/map-scale.mjs'

// Where the inline browser script imports the shared helpers from. Same
// pattern as <usgs-map>: app/browser/* gets bundled to public/browser/* and
// served at /_public/browser/*.
const MAP_SCALE_LIB_URL = '/_public/browser/map-scale.mjs'

export default function mapScale ({ html, state }) {
  const attrs = state?.attrs || {}
  const noScript = attrs['no-script'] != null

  const computed = computeScale({
    zoom: attrs.zoom,
    lat: attrs.lat,
    maxWidthPx: attrs.width,
    units: attrs.units
  })

  if (computed.kind !== 'full') {
    return html`<span class="map-scale map-scale-empty" aria-hidden="true"></span>`
  }

  const inner = renderInnerHTML(computed)
  const maxWidth = hostMaxWidthStyle(computed)

  return html`
<style>
  :host { display: inline-block; }
  .map-scale {
    display: inline-flex;
    flex-direction: column;
    gap: var(--map-scale-gap, 1px);
    padding: var(--map-scale-padding, 3px 6px);
    background-color: var(--map-scale-bg, rgba(255, 255, 255, 0.85));
    color: var(--map-scale-fg, #111111);
    border-radius: var(--map-scale-border-radius, 3px);
    font: var(--map-scale-font, 11px/1 system-ui, sans-serif);
    pointer-events: none;
  }
  .map-scale-row {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1;
  }
  .map-scale-bar {
    position: relative;
    height: 8px;
    box-sizing: border-box;
    border-left: var(--map-scale-line, 1.5px) solid currentColor;
    border-right: var(--map-scale-line, 1.5px) solid currentColor;
    border-bottom: var(--map-scale-line, 1.5px) solid currentColor;
    flex: 0 0 auto;
  }
  .map-scale-tick {
    position: absolute;
    top: 50%;
    width: 0;
    height: 4px;
    border-left: 1px solid currentColor;
    transform: translateX(-0.5px);
  }
  .map-scale-label {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .map-scale-empty { display: none; }
</style>

<span class="map-scale" role="img" aria-label="${computed.ariaLabel}"${maxWidth ? ` style="${maxWidth}"` : ''}>${inner}</span>
${noScript ? '' : renderScript()}
`
}

function renderScript () {
  return `
<script type="module">
import { computeScale, renderInnerHTML, hostMaxWidthStyle } from '${MAP_SCALE_LIB_URL}'

if (!customElements.get('map-scale')) {
  class MapScale extends HTMLElement {
    static get observedAttributes () { return ['lat', 'zoom', 'width', 'units'] }

    connectedCallback () {
      this._mounted = true
      // SSR already produced the correct DOM; no-op until an attr changes.
    }

    attributeChangedCallback (_name, oldVal, newVal) {
      if (!this._mounted) return
      if (oldVal === newVal) return
      this.update()
    }

    update () {
      const span = this.querySelector('.map-scale')
      if (!span) return
      const computed = computeScale({
        zoom: this.getAttribute('zoom'),
        lat: this.getAttribute('lat'),
        maxWidthPx: this.getAttribute('width'),
        units: this.getAttribute('units')
      })
      if (computed.kind !== 'full') {
        span.classList.add('map-scale-empty')
        span.setAttribute('aria-hidden', 'true')
        span.removeAttribute('aria-label')
        span.removeAttribute('role')
        span.removeAttribute('style')
        span.innerHTML = ''
        return
      }
      span.classList.remove('map-scale-empty')
      span.removeAttribute('aria-hidden')
      span.setAttribute('role', 'img')
      span.setAttribute('aria-label', computed.ariaLabel)
      const maxWidth = hostMaxWidthStyle(computed)
      if (maxWidth) span.setAttribute('style', maxWidth)
      else span.removeAttribute('style')
      span.innerHTML = renderInnerHTML(computed)
    }
  }
  customElements.define('map-scale', MapScale)
}
</script>`
}
