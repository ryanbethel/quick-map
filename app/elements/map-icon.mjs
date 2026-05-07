// <map-icon size="24" pin="true">
//
// Purely decorative SVG that says "this thing has a map." No tiles, no
// network, no script. Theme via CSS variables.
//
// Authoring note: per-instance `size` is applied via inline style on the
// inner <span>, never inside the global stylesheet — see the matching note
// in usgs-map.mjs for why.

export default function mapIcon ({ html, state }) {
  const attrs = state?.attrs || {}
  const size = parseInt(attrs.size, 10) > 0 ? parseInt(attrs.size, 10) : 24
  const showPin = attrs.pin == null ? true : attrs.pin !== 'false' && attrs.pin !== '0'

  return html`
<style scope="global">
  map-icon .map-icon {
    display: inline-flex;
    color: var(--map-icon-color, #2b6cb0);
    background-color: var(--map-icon-bg, #e8f0e1);
    border: 1px solid var(--map-icon-border, currentColor);
    border-radius: var(--map-icon-radius, 4px);
    overflow: hidden;
  }
  map-icon .map-icon svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  map-icon .map-icon .map-icon-contour {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.55;
  }
  map-icon .map-icon .map-icon-pin {
    fill: var(--map-icon-pin-color, #d62828);
    stroke: white;
    stroke-width: 0.6;
  }
</style>

<span class="map-icon" role="img" aria-label="Map" style="width: ${size}px; height: ${size}px;">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path class="map-icon-contour" d="M 0 7 C 6 4, 12 9, 18 6 S 24 9, 24 9"/>
    <path class="map-icon-contour" d="M 0 12 C 5 10, 11 14, 17 11 S 24 13, 24 13"/>
    <path class="map-icon-contour" d="M 0 17 C 7 14, 13 19, 19 16 S 24 18, 24 18"/>
    ${showPin ? `<path class="map-icon-pin" d="M12 5 C 9.8 5 8 6.8 8 9 c 0 3 4 7 4 7 s 4 -4 4 -7 c 0 -2.2 -1.8 -4 -4 -4 z M 12 7.6 a 1.4 1.4 0 1 0 0 2.8 a 1.4 1.4 0 0 0 0 -2.8 z"/>` : ''}
  </svg>
</span>
`
}
