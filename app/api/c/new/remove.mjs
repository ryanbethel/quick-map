// POST /c/new/remove — drop one pin from the session draft by index.

export async function post (req) {
  const index = parseInt(req.body?.index, 10)
  const draftPins = Array.isArray(req.session?.draftPins) ? [...req.session.draftPins] : []

  if (Number.isFinite(index) && index >= 0 && index < draftPins.length) {
    draftPins.splice(index, 1)
  }

  const { collectionFlash, ...cleanSession } = req.session || {}
  const last = cleanSession.lastCenter || {}
  const params = new URLSearchParams()
  if (Number.isFinite(parseFloat(last.lat))) params.set('lat', String(last.lat))
  if (Number.isFinite(parseFloat(last.lon))) params.set('lon', String(last.lon))
  if (Number.isFinite(parseInt(last.zoom, 10))) params.set('zoom', String(last.zoom))
  const back = `/c/new${params.toString() ? '?' + params : ''}`

  return {
    session: { ...cleanSession, draftPins },
    location: back
  }
}
