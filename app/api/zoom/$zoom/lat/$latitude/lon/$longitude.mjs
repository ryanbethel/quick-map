import data from '@begin/data'
import { buildTileGrid } from '../../../../../../lib/tiles.mjs'

async function loadRoute (routeId) {
  if (!routeId) return null
  try {
    return await data.get({ table: 'routes', key: routeId })
  } catch (e) {
    console.log('[map] route fetch failed:', e.message)
    return null
  }
}

export async function get (req) {
  const latitude = parseFloat(req.params.latitude)
  const longitude = parseFloat(req.params.longitude)
  const zoom = parseInt(req.params.zoom)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(zoom)) {
    return { status: 400, html: 'Invalid coordinates.' }
  }

  // If a route is active, load it from DDB by id and overlay it on the grid.
  const route = await loadRoute(req.session?.routeId)
  const polylineCoordinates = route?.coordinates || null

  const grid = buildTileGrid({ latitude, longitude, zoom, polylineCoordinates })

  const { zipcode: removeZip, directionsError, addressError, ...newSession } = req.session
  const flash = directionsError || addressError || null
  const hasRoute = Boolean(polylineCoordinates?.length)

  return {
    session: { ...newSession, latitude, longitude, zoom },
    json: {
      ...grid,
      latitude,
      longitude,
      zoom,
      flash,
      hasRoute,
      directions: route
        ? { startAddress: route.startAddress, endAddress: route.endAddress }
        : null
    }
  }
}

export async function post (req) {
  const { zoomIn = false, zoomOut = false, zipCode = false, latitude = '', longitude = '' } = req.body || {}
  let zoom = req.session.zoom || 10
  if (zoomIn && zoom < 16) zoom = zoom + 1
  if (zoomOut && zoom > 0) zoom = zoom - 1

  if (zipCode) {
    let data
    try {
      const response = await fetch('https://api.zippopotam.us/us/' + zipCode)
      data = await response.json()
    } catch (e) {
      console.log(e)
    }
    const place = data?.places?.[0]
    if (!place) {
      return {
        session: { ...req.session, addressError: `No location for ZIP ${zipCode}` },
        location: '/'
      }
    }
    return {
      session: {
        ...req.session,
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude)
      },
      location: '/'
    }
  }

  if (latitude && longitude) {
    return {
      session: { ...req.session, latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      location: '/'
    }
  }

  return {
    session: { ...req.session, zoom },
    location: '/'
  }
}
