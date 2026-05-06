// <map-scale zoom="..." lat="..." width="80" units="dual">
//
// Pure server-rendered scale bar for a Web-Mercator tile map. No client JS.
//
// Picks a "nice" 1-2-5 round value (1, 2, 5, 10, 20, 50, 100, …) that fits in
// the requested max width, draws a bar of the corresponding pixel length, and
// adds inner tick marks. Defaults to a stacked dual-unit display (km + mi).
//
// Attributes:
//   zoom    : Web-Mercator zoom (0–16). Required.
//   lat     : center latitude. Optional but recommended (cosine correction).
//   width   : MAX bar width in px. Default 80. The actual rendered bar is
//             usually shorter — it's whatever the nice round number requires.
//   units   : "dual" (default), "km", or "mi". `dual` shows two stacked bars.
//
// CSS variables:
//   --map-scale-bg, --map-scale-fg, --map-scale-border-radius,
//   --map-scale-padding, --map-scale-font, --map-scale-line, --map-scale-gap.

const PX_PER_TILE = 256
const EARTH_CIRCUMFERENCE_KM = 40075
const KM_PER_PX_Z0 = EARTH_CIRCUMFERENCE_KM / PX_PER_TILE
const KM_PER_MI = 1.609344

export default function mapScale ({ html, state }) {
  const attrs = state?.attrs || {}
  const zoom = parseFloat(attrs.zoom)
  const lat = parseFloat(attrs.lat)
  const maxWidthPx = Number.isFinite(parseFloat(attrs.width)) ? parseFloat(attrs.width) : 80
  const unitsAttr = (attrs.units || 'dual').toLowerCase()
  const units = unitsAttr === 'km' || unitsAttr === 'mi' ? unitsAttr : 'dual'

  if (!Number.isFinite(zoom) || maxWidthPx <= 0) {
    return html`<span class="map-scale map-scale-empty" aria-hidden="true"></span>`
  }

  const cos = Number.isFinite(lat) ? Math.cos((lat * Math.PI) / 180) : 1
  const kmPerPx = (KM_PER_PX_Z0 / Math.pow(2, zoom)) * cos
  const mPerPx = kmPerPx * 1000
  const miPerPx = kmPerPx / KM_PER_MI
  const ftPerPx = miPerPx * 5280

  // For each rail, work in whichever sub-unit gives a whole-number nice-round
  // value at this scale: km or m for metric, mi or ft for imperial.
  const metric = pickRail(maxWidthPx, [
    { unit: 'km', perPx: kmPerPx, threshold: 1 },
    { unit: 'm', perPx: mPerPx, threshold: 0 },
  ])
  const imperial = pickRail(maxWidthPx, [
    { unit: 'mi', perPx: miPerPx, threshold: 1 },
    { unit: 'ft', perPx: ftPerPx, threshold: 0 },
  ])

  const showMetric = units !== 'mi'
  const showImperial = units !== 'km'
  const hostWidth = Math.max(showMetric ? metric.widthPx : 0, showImperial ? imperial.widthPx : 0)

  const ariaLabel = [
    showMetric ? formatLabel(metric) : null,
    showImperial ? formatLabel(imperial) : null,
  ].filter(Boolean).join(', ')

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

<span class="map-scale" role="img" aria-label="${ariaLabel}" style="${hostWidth > 0 ? `max-width: ${Math.ceil(hostWidth + 60)}px` : ''}">
  ${showMetric ? renderBar(metric) : ''}
  ${showImperial ? renderBar(imperial) : ''}
</span>
`
}

function pickRail (maxWidthPx, candidates) {
  // Try each sub-unit (largest first); use the first one whose nice-round
  // value clears its threshold. Falls through to the smallest unit.
  for (let i = 0; i < candidates.length; i++) {
    const { unit, perPx, threshold } = candidates[i]
    const max = maxWidthPx * perPx
    const round = nicelyRound(max)
    const last = i === candidates.length - 1
    if (last || round.value >= threshold) {
      return { unit, value: round.value, segments: round.segments, widthPx: round.value > 0 ? round.value / perPx : 0 }
    }
  }
  return { unit: '', value: 0, segments: 4, widthPx: 0 }
}

function renderBar ({ value, segments, widthPx, unit }) {
  if (value <= 0 || widthPx <= 0) return ''
  const ticks = []
  for (let i = 1; i < segments; i++) {
    const left = (i / segments) * 100
    ticks.push(`<span class="map-scale-tick" style="left: ${left.toFixed(3)}%;"></span>`)
  }
  return `<span class="map-scale-row">
    <span class="map-scale-bar" style="width: ${widthPx.toFixed(1)}px;">${ticks.join('')}</span>
    <span class="map-scale-label">${formatLabel({ value, unit })}</span>
  </span>`
}

function formatLabel ({ value, unit }) {
  if (!unit || value <= 0) return ''
  return `${trimNumber(value)} ${unit}`
}

function trimNumber (n) {
  if (Number.isInteger(n)) return String(n)
  // 1-2-5 nice-round can produce 0.1, 0.2, 0.5 etc when both metric and
  // imperial sub-unit thresholds are 0 (very high zoom). Trim trailing zeros.
  return n.toFixed(2).replace(/\.?0+$/, '')
}

// "Nice" 1-2-5 rounding: pick the largest value of the form
// {1,2,5} × 10^n that's <= max. Returns {value, segments} where segments is
// a sensible number of tick divisions for that mantissa.
function nicelyRound (max) {
  if (!Number.isFinite(max) || max <= 0) return { value: 0, segments: 4 }
  const exp = Math.floor(Math.log10(max))
  const mantissa = max / Math.pow(10, exp)
  let pick, segments
  if (mantissa >= 5) { pick = 5; segments = 5 }
  else if (mantissa >= 2) { pick = 2; segments = 4 }
  else { pick = 1; segments = 4 }
  return { value: pick * Math.pow(10, exp), segments }
}

