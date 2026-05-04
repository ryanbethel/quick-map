import { geocode } from '../lib/geocode.mjs'

export async function post (req) {
  const address = (req.body?.search_address || '').trim()
  const zoom = req.session.zoom || 14

  if (!address) return { location: '/' }

  let coords = null
  try {
    coords = await geocode(address)
  } catch (e) {
    console.log('[address] geocode failed', e.message)
  }

  if (!coords) {
    return {
      session: { ...req.session, addressError: `No results for "${address}"` },
      location: '/'
    }
  }

  const { addressError, ...cleanSession } = req.session
  return {
    session: { ...cleanSession, latitude: coords.latitude, longitude: coords.longitude, zoom },
    location: `/zoom/${zoom}/lat/${coords.latitude}/lon/${coords.longitude}`
  }
}
