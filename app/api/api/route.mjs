// POST /api/route
//
// Body: { start, end }  (each is a string address; lat/lon coords also OK as
//                        "lat,lon")
// Response: 200 { coordinates, maneuvers, start, end }
//        | 400 { error: 'missing start/end' }
//        | 502 { error: '...' }
//
// Used by <route-search> in default ("fetch") mode. The no-JS path delegates
// to /directions which has session + DDB persistence so the existing
// route-overlay flow keeps working unchanged.

import { geocode } from '../../lib/geocode.mjs'
import { fetchRoute } from '../../lib/routing.mjs'

function wantsJson (req) {
  const accept = req.headers?.accept || req.headers?.Accept || ''
  return /application\/json/.test(accept)
}

// Accept "lat,lon" pairs as a shortcut so callers that already have coords
// don't have to round-trip through Nominatim.
async function resolveEndpoint (input) {
  const s = (input || '').trim()
  if (!s) return null
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (m) {
    return {
      latitude: parseFloat(m[1]),
      longitude: parseFloat(m[2]),
      displayName: s
    }
  }
  return geocode(s)
}

export async function post (req) {
  if (!wantsJson(req)) {
    // Defer to the existing session-aware /directions handler for HTML form
    // posts — it does the persist-to-DDB + redirect dance.
    return { location: '/directions', status: 307 }
  }

  const body = req.body || {}
  const startInput = body.start || body.start_address
  const endInput = body.end || body.end_address

  if (!startInput || !endInput) {
    return { status: 400, json: { error: 'missing start or end' } }
  }

  let start, end
  try {
    start = await resolveEndpoint(startInput)
    end = await resolveEndpoint(endInput)
  } catch (e) {
    console.log('[api/route] geocode failed:', e.message)
    return { status: 502, json: { error: `address lookup failed: ${e.message}` } }
  }

  if (!start) return { status: 404, json: { error: `start not found: "${startInput}"` } }
  if (!end) return { status: 404, json: { error: `end not found: "${endInput}"` } }

  let route
  try {
    route = await fetchRoute(start, end)
  } catch (e) {
    console.log('[api/route] route failed:', e.message)
    return { status: 502, json: { error: `route fetch failed: ${e.message}` } }
  }

  return {
    status: 200,
    json: {
      coordinates: route.coordinates,
      maneuvers: route.maneuvers,
      start: { lat: start.latitude, lon: start.longitude, displayName: start.displayName },
      end: { lat: end.latitude, lon: end.longitude, displayName: end.displayName }
    }
  }
}
