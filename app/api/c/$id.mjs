// GET /c/$id — load a saved collection from DDB and render it on the map.
//
// Default center is the bounding-box center of all pins; default zoom is a
// rough best-fit based on the bbox span. Both are overrideable via query
// params (`?lat=&lon=&zoom=`) so the no-JS pan/zoom buttons work.

import data from '@begin/data'
import { bboxCenterAndZoom, fitTilesFor } from '../../lib/tiles.mjs'

const DEFAULT_GRID = 7

export async function get (req) {
  const id = req.params?.id
  if (!id) return { status: 404, html: 'Collection not found.' }

  let row
  try {
    row = await data.get({ table: 'collections', key: id })
  } catch (e) {
    console.log('[collections] load failed:', e.message)
    return { status: 500, html: 'Could not load collection.' }
  }

  if (!row || !Array.isArray(row.pins) || row.pins.length === 0) {
    return { status: 404, html: 'Collection not found or empty.' }
  }

  const gridCols = clampGrid(parseInt(req.query?.cols, 10))
  const gridRows = clampGrid(parseInt(req.query?.rows, 10))
  const viewW = parseInt(req.query?.w, 10)
  const viewH = parseInt(req.query?.h, 10)
  const fitX = fitTilesFor(viewW, gridCols)
  const fitY = fitTilesFor(viewH, gridRows)
  const fit = bboxCenterAndZoom(row.pins, fitX, fitY)
  // ?fit=1 forces bbox-fit even when lat/lon/zoom are present in the URL.
  // The client uses this for container-resize-driven re-renders so stale
  // (and possibly wrongly-sized) lat/lon/zoom don't defeat the fit math.
  const forceFit = req.query?.fit === '1' || req.query?.fit === 'true'
  const qLat = parseFloat(req.query?.lat)
  const qLon = parseFloat(req.query?.lon)
  const qZoom = parseInt(req.query?.zoom, 10)

  const centerLat = (!forceFit && Number.isFinite(qLat)) ? qLat : fit.centerLat
  const centerLon = (!forceFit && Number.isFinite(qLon)) ? qLon : fit.centerLon
  const zoom = (!forceFit && Number.isFinite(qZoom)) ? Math.max(0, Math.min(16, qZoom)) : fit.zoom

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
      collectionId: id,
      collectionTitle: row.title || '',
      pins: row.pins,
      fit
    }
  }
}

function clampGrid (n) {
  if (!Number.isFinite(n)) return DEFAULT_GRID
  // Allow grids as small as 3 so embedded/preview iframes can shrink the
  // wrap to roughly match their viewport (matches the editor's runtime
  // bound for minimal-mode renders).
  return Math.max(3, Math.min(13, n))
}
