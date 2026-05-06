// GET /c/new — render the collection creator with the current draft pins.
//
// Center/zoom come from query params (so the no-JS pan/zoom URLs work), and
// fall back to session.lastCenter, then a hard default. Grid size (cols/rows)
// is set by the client-side enhancement on first load to match the viewport.

import { bboxCenterAndZoom, fitTilesFor } from '../../browser/tiles.mjs'

const DEFAULT = { lat: 43.68, lon: -70.25, zoom: 10 }

export async function get (req) {
  const draftPins = Array.isArray(req.session?.draftPins) ? req.session.draftPins : []

  const qLat = parseFloat(req.query?.lat)
  const qLon = parseFloat(req.query?.lon)
  const qZoom = parseInt(req.query?.zoom, 10)
  const gridCols = clampGrid(parseInt(req.query?.cols, 10))
  const gridRows = clampGrid(parseInt(req.query?.rows, 10))
  // Client passes the iframe pixel dimensions when available so the bbox
  // fit knows what's actually visible (the wrap is intentionally larger
  // than the viewport — see usgs-map.mjs).
  const viewW = parseInt(req.query?.w, 10)
  const viewH = parseInt(req.query?.h, 10)
  const fitX = fitTilesFor(viewW, gridCols)
  const fitY = fitTilesFor(viewH, gridRows)
  const fit = bboxCenterAndZoom(draftPins, fitX, fitY)
  const previewMode = req.query?.preview === '1'

  // Preview: same draft pins, no chrome (no controls, no info panel). Used by
  // /embed/dual to render the second iframe. Always centers on the bbox-fit
  // of the current pins — lat/lon/zoom from the URL are ignored on purpose so
  // the preview locks onto the cloud no matter how it was navigated to.
  if (previewMode) {
    const centerLat = fit ? fit.centerLat : DEFAULT.lat
    const centerLon = fit ? fit.centerLon : DEFAULT.lon
    const zoom = fit ? fit.zoom : DEFAULT.zoom
    return {
      json: {
        centerLat,
        centerLon,
        zoom,
        gridCols,
        gridRows,
        viewW: Number.isFinite(viewW) ? viewW : null,
        viewH: Number.isFinite(viewH) ? viewH : null,
        collectionMode: 'view',
        chrome: 'minimal',
        collectionTitle: `${draftPins.length} draft pin${draftPins.length === 1 ? '' : 's'}`,
        pins: draftPins,
        fit
      }
    }
  }

  // ?fit=1 forces bbox-fit even when lat/lon/zoom are present in the URL —
  // the client uses this signal on container-resize re-renders so the fit
  // is recomputed against the new w/h instead of carrying stale state.
  const forceFit = req.query?.fit === '1' || req.query?.fit === 'true'

  const last = req.session?.lastCenter || {}
  const centerLat = (!forceFit && Number.isFinite(qLat)) ? qLat
    : (forceFit && fit ? fit.centerLat
      : (Number.isFinite(parseFloat(last.lat)) ? parseFloat(last.lat) : DEFAULT.lat))
  const centerLon = (!forceFit && Number.isFinite(qLon)) ? qLon
    : (forceFit && fit ? fit.centerLon
      : (Number.isFinite(parseFloat(last.lon)) ? parseFloat(last.lon) : DEFAULT.lon))
  const zoom = (!forceFit && Number.isFinite(qZoom)) ? Math.max(0, Math.min(16, qZoom))
    : (forceFit && fit ? fit.zoom
      : (Number.isFinite(parseInt(last.zoom, 10)) ? parseInt(last.zoom, 10) : DEFAULT.zoom))

  const { collectionFlash: flash, ...cleanSession } = req.session || {}

  return {
    session: {
      ...cleanSession,
      lastCenter: { lat: centerLat, lon: centerLon, zoom }
    },
    json: {
      centerLat,
      centerLon,
      zoom,
      gridCols,
      gridRows,
      viewW: Number.isFinite(viewW) ? viewW : null,
      viewH: Number.isFinite(viewH) ? viewH : null,
      collectionMode: 'create',
      draftPinCount: draftPins.length,
      pins: draftPins,
      fit,
      flash: flash || null
    }
  }
}

function clampGrid (n) {
  if (!Number.isFinite(n)) return 7
  // Allow grids as small as 3 so the preview iframe can size itself down to
  // its viewport. Without this, MIN=5 forced a 1280-px wrap inside ~720-px
  // iframes and bbox-fit pushed edge pins past the visible area.
  return Math.max(3, Math.min(13, n))
}
