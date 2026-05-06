// POST /api/geocode
//
// Body (form-encoded or JSON): { address }
// Response: 200 { lat, lon, displayName }
//        | 400 { error: 'missing address' }
//        | 404 { error: 'no results' }
//        | 502 { error: '...' }
//
// Used by <address-search> in default ("fetch") mode. The same handler also
// serves the no-JS form post — when the request's Accept header doesn't ask
// for JSON we 302 to /zoom/{zoom}/lat/{lat}/lon/{lon} so the legacy page
// keeps working without a separate route.

import { geocode } from '../../lib/geocode.mjs'

function wantsJson (req) {
  const accept = req.headers?.accept || req.headers?.Accept || ''
  return /application\/json/.test(accept)
}

export async function post (req) {
  const body = req.body || {}
  const address = (body.address || body.search_address || '').trim()

  if (!address) {
    if (wantsJson(req)) {
      return { status: 400, json: { error: 'missing address' } }
    }
    return {
      session: { ...req.session, addressError: 'Enter an address.' },
      location: '/'
    }
  }

  let coords = null
  try {
    coords = await geocode(address)
  } catch (e) {
    console.log('[api/geocode] failed:', e.message)
    if (wantsJson(req)) {
      return { status: 502, json: { error: e.message } }
    }
    return {
      session: { ...req.session, addressError: `Lookup failed (${e.message}).` },
      location: '/'
    }
  }

  if (!coords) {
    if (wantsJson(req)) {
      return { status: 404, json: { error: `no results for "${address}"` } }
    }
    return {
      session: { ...req.session, addressError: `No results for "${address}"` },
      location: '/'
    }
  }

  if (wantsJson(req)) {
    return {
      status: 200,
      json: {
        lat: coords.latitude,
        lon: coords.longitude,
        displayName: coords.displayName
      }
    }
  }

  // No-JS fallback: drop the user on the legacy lat/lon map page.
  const zoom = req.session?.zoom || 14
  const { addressError: _drop, ...cleanSession } = req.session || {}
  return {
    session: { ...cleanSession, latitude: coords.latitude, longitude: coords.longitude, zoom },
    location: `/zoom/${zoom}/lat/${coords.latitude}/lon/${coords.longitude}`
  }
}
