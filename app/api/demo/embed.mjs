// GET /demo/embed — minimal map page used as the iframe target on the
// kitchen-sink page. Hardcodes a small demo pin set; accepts ?lat/lon/zoom
// from URL so external <map-nav> / <address-search> controls can drive it.

import { bboxCenterAndZoom, fitTilesFor } from '../../browser/tiles.mjs'

const DEMO_PINS = [
  { lat: 43.6614, lon: -70.2553, name: 'Old Port' },
  { lat: 43.6531, lon: -70.2376, name: 'Munjoy Hill' },
  { lat: 43.6422, lon: -70.2167, name: 'Eastern Promenade' },
  { lat: 43.6822, lon: -70.3014, name: 'Stroudwater' }
]

export async function get (req) {
  const cols = clampGrid(parseInt(req.query?.cols, 10), 5)
  const rows = clampGrid(parseInt(req.query?.rows, 10), 5)
  const viewW = parseInt(req.query?.w, 10)
  const viewH = parseInt(req.query?.h, 10)
  const fit = bboxCenterAndZoom(DEMO_PINS, fitTilesFor(viewW, cols), fitTilesFor(viewH, rows))
  const forceFit = req.query?.fit === '1'
  const qLat = parseFloat(req.query?.lat)
  const qLon = parseFloat(req.query?.lon)
  const qZoom = parseInt(req.query?.zoom, 10)

  const centerLat = (!forceFit && Number.isFinite(qLat)) ? qLat : fit.centerLat
  const centerLon = (!forceFit && Number.isFinite(qLon)) ? qLon : fit.centerLon
  const zoom = (!forceFit && Number.isFinite(qZoom)) ? Math.max(0, Math.min(16, qZoom)) : fit.zoom
  const render = req.query?.render === 'client' ? 'client' : 'server'

  return {
    json: {
      centerLat,
      centerLon,
      zoom,
      gridCols: cols,
      gridRows: rows,
      viewW: Number.isFinite(viewW) ? viewW : null,
      viewH: Number.isFinite(viewH) ? viewH : null,
      pins: DEMO_PINS,
      fit,
      render,
      // Demo embed: render without chrome by default so iframes are pure
      // tiles + pins. Pages that want the built-in chrome can load /c/new
      // or /c/$id, which keep their default chrome.
      controls: 'none',
      info: 'none'
    }
  }
}

function clampGrid (n, fallback) {
  if (!Number.isFinite(n)) return fallback
  return Math.max(3, Math.min(13, n))
}
