// Directions handler.
//
// Contract (no client JS, no geolocation):
//   POST /directions
//     body: { start_address: string, end_address: string }
//
// Steps:
//   1. Geocode both addresses via Nominatim.
//   2. Ask Valhalla for an auto route between them.
//   3. Save the encoded polyline + endpoints in the session.
//   4. Redirect to /zoom/{zoom}/lat/{end_lat}/lon/{end_lon} so the unified
//      map page renders with the route overlay arriving at the destination.
//
// Failure at any step writes a clear `directionsError` flash to the session
// and bounces to /.

import { randomUUID } from 'node:crypto'
import data from '@begin/data'
import { geocode } from '../lib/geocode.mjs'

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route'
const ROUTE_TTL_SECONDS = 24 * 60 * 60 // routes expire from DDB after 24h

async function fetchRoute (start, end) {
  const res = await fetch(VALHALLA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: [
        { lat: start.latitude, lon: start.longitude },
        { lat: end.latitude, lon: end.longitude }
      ],
      costing: 'auto'
    })
  })
  if (!res.ok) throw new Error(`Valhalla ${res.status}`)
  const data = await res.json()
  const leg = data?.trip?.legs?.[0]
  if (!leg?.shape) throw new Error('Valhalla returned no route')
  return {
    polyline: leg.shape,
    maneuvers: (leg.maneuvers || []).map(m => m.instruction)
  }
}

function bail (req, message) {
  return {
    session: { ...req.session, directionsError: message },
    location: '/'
  }
}

export async function post (req) {
  const startAddress = (req.body?.start_address || '').trim()
  const endAddress = (req.body?.end_address || '').trim()
  console.log('[directions] start=%j end=%j', startAddress, endAddress)

  if (!startAddress || !endAddress) {
    return bail(req, 'Enter both a start and an end address.')
  }

  // Geocode both addresses. Nominatim asks for ~1 req/sec so do these
  // sequentially rather than in parallel.
  let start, end
  try {
    start = await geocode(startAddress)
    end = await geocode(endAddress)
  } catch (e) {
    console.log('[directions] geocode failed:', e.message)
    return bail(req, `Address lookup failed (${e.message}).`)
  }
  if (!start) return bail(req, `Could not find start address: "${startAddress}"`)
  if (!end) return bail(req, `Could not find end address: "${endAddress}"`)

  console.log('[directions] resolved start=%o end=%o', start, end)

  let route
  try {
    route = await fetchRoute(start, end)
    console.log('[directions] got %d-char polyline, %d maneuvers', route.polyline.length, route.maneuvers.length)
  } catch (e) {
    console.log('[directions] route fetch failed:', e.message)
    return bail(req, `Could not fetch directions (${e.message}).`)
  }

  // The polyline is too large (~7-8KB for an interstate) to fit in a JWE
  // session cookie (~4KB limit). Store it in DDB via @begin/data and keep
  // only a small id in the session.
  const routeId = randomUUID()
  try {
    await data.set({
      table: 'routes',
      key: routeId,
      polyline: route.polyline,
      maneuvers: route.maneuvers,
      startAddress: start.displayName,
      endAddress: end.displayName,
      ttl: Math.floor(Date.now() / 1000) + ROUTE_TTL_SECONDS
    })
  } catch (e) {
    console.log('[directions] route persist failed:', e.message)
    return bail(req, `Could not save route (${e.message}).`)
  }

  // Drop any prior route's id (and the old `directions` blob if present from
  // an earlier version) so the session stays small.
  const { routeId: oldRouteId, directions: oldDirections, ...cleanSession } = req.session
  if (oldRouteId) {
    data.destroy({ table: 'routes', key: oldRouteId }).catch(() => {})
  }

  const zoom = req.session.zoom || 14
  return {
    session: {
      ...cleanSession,
      latitude: end.latitude,
      longitude: end.longitude,
      zoom,
      routeId
    },
    location: `/zoom/${zoom}/lat/${end.latitude}/lon/${end.longitude}`
  }
}
