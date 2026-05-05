// POST /c/new/add — append a pin to the session draft. Bounces back to
// /c/new at the user's current view (from session.lastCenter, set by every
// GET /c/new), so click-to-add doesn't yank the map to the pin's location.

const MAX_PINS = 50

export async function post (req) {
  const lat = parseFloat(req.body?.lat)
  const lon = parseFloat(req.body?.lon)
  const name = (req.body?.name || '').trim().slice(0, 80)
  const note = (req.body?.note || '').trim().slice(0, 200)

  const last = req.session?.lastCenter || {}
  const viewLat = parseFloat(last.lat)
  const viewLon = parseFloat(last.lon)
  const viewZoom = parseInt(last.zoom, 10)
  const params = new URLSearchParams()
  if (Number.isFinite(viewLat)) params.set('lat', String(viewLat))
  if (Number.isFinite(viewLon)) params.set('lon', String(viewLon))
  if (Number.isFinite(viewZoom)) params.set('zoom', String(viewZoom))
  const back = `/c/new${params.toString() ? '?' + params : ''}`

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      session: { ...req.session, collectionFlash: 'Invalid coordinates for new pin.' },
      location: back
    }
  }

  const draftPins = Array.isArray(req.session?.draftPins) ? [...req.session.draftPins] : []
  if (draftPins.length >= MAX_PINS) {
    return {
      session: { ...req.session, collectionFlash: `Pin limit reached (${MAX_PINS}).` },
      location: back
    }
  }

  draftPins.push({ lat, lon, name, note })

  const { collectionFlash: _drop, ...cleanSession } = req.session || {}
  return {
    session: { ...cleanSession, draftPins },
    location: back
  }
}
