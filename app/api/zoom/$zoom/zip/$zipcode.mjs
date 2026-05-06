import data from '@begin/data'
import { buildTileGrid } from '../../../../browser/tiles.mjs'

async function lookupZip (zipcode) {
  const cached = await data.get({ table: 'zip', key: zipcode }).catch(() => null)
  if (cached?.latitude && cached?.longitude) return cached

  const res = await fetch('https://api.zippopotam.us/us/' + zipcode)
  if (!res.ok) return null
  const result = await res.json().catch(() => null)
  const place = result?.places?.[0]
  if (!place) return null

  const coords = {
    latitude: parseFloat(place.latitude),
    longitude: parseFloat(place.longitude)
  }
  if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return null

  data.set({ table: 'zip', key: zipcode, ...coords }).catch(err => console.log('zip cache write failed', err))
  return coords
}

export async function get (req) {
  const zoom = parseInt(req.params.zoom)
  const zipcode = req.params.zipcode
  if (!Number.isFinite(zoom) || !zipcode) {
    return { status: 400, html: 'Invalid zoom or zipcode.' }
  }

  const coords = await lookupZip(zipcode)
  if (!coords) {
    return {
      session: { ...req.session, addressError: `No location for ZIP ${zipcode}` },
      location: '/'
    }
  }

  let route = null
  if (req.session?.routeId) {
    try {
      route = await data.get({ table: 'routes', key: req.session.routeId })
    } catch (e) {
      console.log('[zip] route fetch failed:', e.message)
    }
  }
  const polylineCoordinates = route?.coordinates || null
  const grid = buildTileGrid({
    latitude: coords.latitude,
    longitude: coords.longitude,
    zoom,
    polylineCoordinates
  })

  const { latitude: removeLat, longitude: removeLon, addressError, directionsError, ...newSession } = req.session
  const flash = directionsError || addressError || null
  const hasRoute = Boolean(polylineCoordinates?.length)

  return {
    session: { ...newSession, zoom, zipcode },
    json: {
      ...grid,
      latitude: coords.latitude,
      longitude: coords.longitude,
      zoom,
      zipcode,
      flash,
      hasRoute,
      directions: route
        ? { startAddress: route.startAddress, endAddress: route.endAddress }
        : null
    }
  }
}
