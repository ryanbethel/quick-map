// Shared math + render helpers for <map-scale>. Used by both:
//   - the SSR template in app/elements/map-scale.mjs (imported relatively)
//   - the inline browser script that <map-scale> emits, which imports the
//     bundled copy at /_public/browser/map-scale.mjs and registers the
//     Custom Element so attribute changes (lat / zoom / width / units)
//     re-render the bar in place without a server roundtrip.
//
// Pure functions — no DOM access here.

const PX_PER_TILE = 256
const EARTH_CIRCUMFERENCE_KM = 40075
const KM_PER_PX_Z0 = EARTH_CIRCUMFERENCE_KM / PX_PER_TILE
const KM_PER_MI = 1.609344

// Build a derived view from the four element attributes. Returns either a
// `{ kind: 'empty' }` shape (when zoom/width are bad) or a full
// `{ kind: 'full', metric, imperial, showMetric, showImperial, hostWidth, ariaLabel }`.
export function computeScale ({ zoom, lat, maxWidthPx, units }) {
  const z = parseFloat(zoom)
  const w = Number.isFinite(parseFloat(maxWidthPx)) ? parseFloat(maxWidthPx) : 80
  const u = ((units || 'dual') + '').toLowerCase()
  const unit = u === 'km' || u === 'mi' ? u : 'dual'

  if (!Number.isFinite(z) || w <= 0) {
    return { kind: 'empty' }
  }

  const cos = Number.isFinite(parseFloat(lat)) ? Math.cos((parseFloat(lat) * Math.PI) / 180) : 1
  const kmPerPx = (KM_PER_PX_Z0 / Math.pow(2, z)) * cos
  const mPerPx = kmPerPx * 1000
  const miPerPx = kmPerPx / KM_PER_MI
  const ftPerPx = miPerPx * 5280

  const metric = pickRail(w, [
    { unit: 'km', perPx: kmPerPx, threshold: 1 },
    { unit: 'm', perPx: mPerPx, threshold: 0 }
  ])
  const imperial = pickRail(w, [
    { unit: 'mi', perPx: miPerPx, threshold: 1 },
    { unit: 'ft', perPx: ftPerPx, threshold: 0 }
  ])

  const showMetric = unit !== 'mi'
  const showImperial = unit !== 'km'
  const hostWidth = Math.max(showMetric ? metric.widthPx : 0, showImperial ? imperial.widthPx : 0)
  const ariaLabel = [
    showMetric ? formatLabel(metric) : null,
    showImperial ? formatLabel(imperial) : null
  ].filter(Boolean).join(', ')

  return { kind: 'full', metric, imperial, showMetric, showImperial, hostWidth, ariaLabel }
}

// HTML for the inner content of the `.map-scale` span (the two stacked
// metric/imperial rows). Empty string for a `kind: 'empty'` view.
export function renderInnerHTML (computed) {
  if (!computed || computed.kind !== 'full') return ''
  return [
    computed.showMetric ? renderBar(computed.metric) : '',
    computed.showImperial ? renderBar(computed.imperial) : ''
  ].join('')
}

// Convenience: the inline `style="max-width: ..."` value (or '' when none).
export function hostMaxWidthStyle (computed) {
  if (!computed || computed.kind !== 'full' || !(computed.hostWidth > 0)) return ''
  return 'max-width: ' + Math.ceil(computed.hostWidth + 60) + 'px'
}

function pickRail (maxWidthPx, candidates) {
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
    ticks.push('<span class="map-scale-tick" style="left: ' + left.toFixed(3) + '%;"></span>')
  }
  return '<span class="map-scale-row">' +
    '<span class="map-scale-bar" style="width: ' + widthPx.toFixed(1) + 'px;">' + ticks.join('') + '</span>' +
    '<span class="map-scale-label">' + formatLabel({ value, unit }) + '</span>' +
    '</span>'
}

function formatLabel ({ value, unit }) {
  if (!unit || value <= 0) return ''
  return trimNumber(value) + ' ' + unit
}

function trimNumber (n) {
  if (Number.isInteger(n)) return String(n)
  // 1-2-5 nice-round can produce 0.1, 0.2, 0.5 etc when both metric and
  // imperial sub-unit thresholds are 0 (very high zoom). Trim trailing zeros.
  return n.toFixed(2).replace(/\.?0+$/, '')
}

// "Nice" 1-2-5 rounding: pick the largest value of the form
// {1,2,5} x 10^n that's <= max. Returns {value, segments} where segments is
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
