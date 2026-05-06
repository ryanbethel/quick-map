// GET /demo/route — kitchen-sink example showing a route polyline rendered
// on a <usgs-map>, automatically bbox-fitted to the route's bounds.
//
// Hardcodes start + end coords (Portland, ME → Augusta, ME) and fetches the
// route at request time. fetchRoute already falls back from Valhalla → OSRM
// → straight-line, so this works whether or not external services are up.

import { fetchRoute } from '../../lib/routing.mjs'
import { bboxCenterAndZoom, fitTilesFor } from '../../lib/tiles.mjs'

const START = { latitude: 43.6614, longitude: -70.2553, displayName: 'Portland, ME' }
const END = { latitude: 44.3106, longitude: -69.7795, displayName: 'Augusta, ME' }

export async function get (req) {
  const cols = clampGrid(parseInt(req.query?.cols, 10), 5)
  const rows = clampGrid(parseInt(req.query?.rows, 10), 5)
  const viewW = parseInt(req.query?.w, 10)
  const viewH = parseInt(req.query?.h, 10)

  let coordinates = null
  let maneuvers = []
  try {
    const route = await fetchRoute(START, END)
    coordinates = route.coordinates
    maneuvers = route.maneuvers
  } catch (e) {
    console.log('[demo/route] route failed:', e.message)
  }

  // Fit the map to the polyline's bounds. coordinates are [lat, lon] pairs;
  // bboxCenterAndZoom expects { lat, lon } objects.
  const fitPoints = (coordinates || []).map(([lat, lon]) => ({ lat, lon }))
  const fit = bboxCenterAndZoom(
    fitPoints.length >= 2 ? fitPoints : [
      { lat: START.latitude, lon: START.longitude },
      { lat: END.latitude, lon: END.longitude }
    ],
    fitTilesFor(viewW, cols),
    fitTilesFor(viewH, rows)
  )

  const forceFit = req.query?.fit === '1'
  const qLat = parseFloat(req.query?.lat)
  const qLon = parseFloat(req.query?.lon)
  const qZoom = parseInt(req.query?.zoom, 10)

  const centerLat = (!forceFit && Number.isFinite(qLat)) ? qLat : fit.centerLat
  const centerLon = (!forceFit && Number.isFinite(qLon)) ? qLon : fit.centerLon
  const zoom = (!forceFit && Number.isFinite(qZoom)) ? Math.max(0, Math.min(16, qZoom)) : fit.zoom

  return {
    json: {
      centerLat,
      centerLon,
      zoom,
      gridCols: cols,
      gridRows: rows,
      viewW: Number.isFinite(viewW) ? viewW : null,
      viewH: Number.isFinite(viewH) ? viewH : null,
      polylineCoordinates: coordinates,
      maneuvers,
      start: { lat: START.latitude, lon: START.longitude, name: START.displayName },
      end: { lat: END.latitude, lon: END.longitude, name: END.displayName },
      fit,
      controls: 'none',
      info: 'none'
    }
  }
}

function clampGrid (n, fallback) {
  if (!Number.isFinite(n)) return fallback
  return Math.max(3, Math.min(13, n))
}
