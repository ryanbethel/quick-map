// Routing adapter. Pick a backend at runtime via env vars:
//
//   ROUTING_ENGINE  one of: "valhalla" (default), "osrm", "straight"
//   ROUTING_URL     base URL override; sensible public default per engine
//
// Every adapter returns the same shape so the rest of the app stays oblivious
// to which backend produced the route:
//
//   {
//     coordinates: [[lat, lon], ...],   // already decoded
//     maneuvers:   string[]              // human-readable turn-by-turn
//   }
//
// Adding a new engine = write `async function fetchFromX(start, end)` with the
// same return shape and add a case to `fetchRoute`.

import { decodePolyline } from './tiles.mjs'

const TIMEOUT_MS = 8000

const DEFAULT_URL = {
  valhalla: 'https://valhalla1.openstreetmap.de/route',
  osrm: 'https://router.project-osrm.org/route/v1/driving'
}

export async function fetchRoute (start, end) {
  const engine = (process.env.ROUTING_ENGINE || 'valhalla').toLowerCase()
  switch (engine) {
  case 'valhalla': return fetchFromValhalla(start, end)
  case 'osrm':     return fetchFromOSRM(start, end)
  case 'straight': return straightLine(start, end)
  default: throw new Error(`Unknown ROUTING_ENGINE: ${engine}`)
  }
}

async function fetchFromValhalla (start, end) {
  const url = process.env.ROUTING_URL || DEFAULT_URL.valhalla
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: [
        { lat: start.latitude, lon: start.longitude },
        { lat: end.latitude, lon: end.longitude }
      ],
      costing: 'auto'
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`Valhalla ${res.status}`)
  const body = await res.json()
  const leg = body?.trip?.legs?.[0]
  if (!leg?.shape) throw new Error('Valhalla returned no route')
  return {
    coordinates: decodePolyline(leg.shape, 6),
    maneuvers: (leg.maneuvers || []).map(m => m.instruction).filter(Boolean)
  }
}

async function fetchFromOSRM (start, end) {
  const base = (process.env.ROUTING_URL || DEFAULT_URL.osrm).replace(/\/$/, '')
  const coords = `${start.longitude},${start.latitude};${end.longitude},${end.latitude}`
  const url = `${base}/${coords}?overview=full&steps=true&geometries=polyline`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`OSRM ${res.status}`)
  const body = await res.json()
  const route = body?.routes?.[0]
  if (!route?.geometry) throw new Error('OSRM returned no route')
  // OSRM uses Google polyline precision 5 by default.
  return {
    coordinates: decodePolyline(route.geometry, 5),
    maneuvers: (route.legs?.[0]?.steps || []).map(osrmStepToInstruction).filter(Boolean)
  }
}

// OSRM doesn't ship prose instructions; build a short one from the maneuver.
function osrmStepToInstruction (step) {
  const m = step?.maneuver
  if (!m?.type) return null
  const action = m.modifier ? `${m.type} ${m.modifier}` : m.type
  const name = step.name || ''
  return name ? `${action} onto ${name}` : action
}

// No external service. Two-point line; the SVG renderer handles short paths.
// Useful as a zero-dependency fallback or for fully offline / air-gapped use.
function straightLine (start, end) {
  return {
    coordinates: [
      [start.latitude, start.longitude],
      [end.latitude, end.longitude]
    ],
    maneuvers: ['Head toward destination.', 'Arrive at destination.']
  }
}
