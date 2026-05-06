// Shared map-tile / Web-Mercator helpers used by the map and directions routes.
// Pure functions, no I/O.

export const PIXELS_PER_TILE = 256

// Best-fit center + zoom for a set of points within a fit window.
// `fitTilesX`/`fitTilesY` is the size (in tile-widths, may be fractional)
// of the area pins should fit within after subtracting any desired margin.
// e.g. `(visiblePx / 256) - 1` leaves a half-tile of margin per side.
// Single point returns a fixed close-in zoom; empty/invalid returns null.
export function bboxCenterAndZoom (pins, fitTilesX = 3, fitTilesY = 3) {
  if (!Array.isArray(pins) || pins.length === 0) return null
  if (pins.length === 1) {
    return { centerLat: pins[0].lat, centerLon: pins[0].lon, zoom: 13 }
  }
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
  for (const p of pins) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }
  const centerLat = (minLat + maxLat) / 2
  const centerLon = (minLon + maxLon) / 2
  const lonSpan = Math.max(maxLon - minLon, 1e-6)
  const latSpan = Math.max(maxLat - minLat, 1e-6)
  // At zoom z, lonSpan degrees occupy `lonSpan/360 * 2^z` tile-widths.
  // Largest z s.t. that fits in the fit window is floor(log2(fit*360/span)).
  const padX = Math.max(fitTilesX, 0.5)
  const padY = Math.max(fitTilesY, 0.5)
  const zLon = Math.log2((padX * 360) / lonSpan)
  const zLat = Math.log2((padY * 180) / latSpan)
  const z = Math.floor(Math.min(zLon, zLat))
  return {
    centerLat,
    centerLon,
    zoom: Math.max(2, Math.min(16, z))
  }
}

// Convert a viewport size (or grid-tile count) to a fit window suitable for
// bboxCenterAndZoom. `viewportPx` (when finite) is preferred — it knows the
// real visible iframe — and we drop one tile total (half on each side) for
// margin. Otherwise we fall back to grid-tile based padding (gridCols-2),
// which roughly matches the old behavior and works for no-JS first loads.
export function fitTilesFor (viewportPx, gridTiles) {
  if (Number.isFinite(viewportPx) && viewportPx > 0) {
    return Math.max(viewportPx / PIXELS_PER_TILE - 1, 0.5)
  }
  return Math.max((gridTiles || 0) - 2, 1)
}
export const USGS_TILE_URL = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'

// Earth circumference at the equator, km. Used to compute the displayed scale bar.
const EARTH_CIRCUMFERENCE_KM = 40075
const KM_PER_PX_AT_ZOOM_0 = EARTH_CIRCUMFERENCE_KM / PIXELS_PER_TILE

export function lon2tile (lon, zoom) {
  const value = ((lon + 180) / 360) * Math.pow(2, zoom)
  const tile = Math.floor(value)
  return { tile, pixelsOffset: (value - tile) * PIXELS_PER_TILE }
}

export function lat2tile (lat, zoom) {
  const rad = (lat * Math.PI) / 180
  const value = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  const tile = Math.floor(value)
  return { tile, pixelsOffset: (value - tile) * PIXELS_PER_TILE }
}

// Convert (lat, lon) at a given zoom to pixel coords LOCAL to the tile at
// (tileX, tileY). Anything outside [0, 256] is naturally clipped per-tile.
export function latLonToTilePixel (lat, lon, zoom, tileX, tileY) {
  const n = Math.pow(2, zoom)
  const globalX = ((lon + 180) / 360) * n * PIXELS_PER_TILE
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const globalY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n * PIXELS_PER_TILE
  return {
    x: globalX - tileX * PIXELS_PER_TILE,
    y: globalY - tileY * PIXELS_PER_TILE
  }
}

export function latLonToGlobalPixel (lat, lon, zoom) {
  const n = Math.pow(2, zoom)
  const x = ((lon + 180) / 360) * n * PIXELS_PER_TILE
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n * PIXELS_PER_TILE
  return { x, y }
}

export function globalPixelToLatLon (x, y, zoom) {
  const n = Math.pow(2, zoom)
  const total = n * PIXELS_PER_TILE
  const lon = (x / total) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / total))) * 180) / Math.PI
  return { lat, lon }
}

// Wrap-local pixel position of the (lat, lon) center inside an N x M tile
// grid produced by `buildTileGrid`. Equivalent to
// `latLonToGridPixel(lat, lon, zoom, lat, lon, cols, rows)`. Used as the
// pan/zoom anchor — the lat/lon center is up to half a tile off the wrap's
// geometric center, so anchoring on the wrap center would over-pan by that
// amount.
export function crosshairPixel (lat, lon, zoom, cols, rows) {
  const total = Math.pow(2, zoom) * PIXELS_PER_TILE
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const cx = ((lon + 180) / 360) * total
  const cy = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * total
  const centerCol = Math.floor((cols - 1) / 2)
  const centerRow = Math.floor((rows - 1) / 2)
  const offX = cx - Math.floor(cx / PIXELS_PER_TILE) * PIXELS_PER_TILE
  const offY = cy - Math.floor(cy / PIXELS_PER_TILE) * PIXELS_PER_TILE
  return {
    x: centerCol * PIXELS_PER_TILE + offX,
    y: centerRow * PIXELS_PER_TILE + offY
  }
}

// Convert (lat, lon) to pixel coords inside the rows x cols tile grid produced
// by `buildTileGrid`. (0, 0) is the top-left of the grid container; the lat/lon
// center sits at (centerCol * 256 + offsetX, centerRow * 256 + offsetY).
export function latLonToGridPixel (lat, lon, zoom, centerLat, centerLon, gridCols = 5, gridRows = 5) {
  const here = latLonToGlobalPixel(lat, lon, zoom)
  const center = latLonToGlobalPixel(centerLat, centerLon, zoom)
  const centerCol = Math.floor((gridCols - 1) / 2)
  const centerRow = Math.floor((gridRows - 1) / 2)
  const offsetX = center.x - Math.floor(center.x / PIXELS_PER_TILE) * PIXELS_PER_TILE
  const offsetY = center.y - Math.floor(center.y / PIXELS_PER_TILE) * PIXELS_PER_TILE
  const centerGridX = centerCol * PIXELS_PER_TILE + offsetX
  const centerGridY = centerRow * PIXELS_PER_TILE + offsetY
  return {
    x: centerGridX + (here.x - center.x),
    y: centerGridY + (here.y - center.y)
  }
}

// Inverse of `latLonToGridPixel`. Used to translate a click/drag-release
// position on the grid back into geographic coordinates.
export function pixelToLatLon (px, py, zoom, centerLat, centerLon, gridCols = 5, gridRows = 5) {
  const center = latLonToGlobalPixel(centerLat, centerLon, zoom)
  const centerCol = Math.floor((gridCols - 1) / 2)
  const centerRow = Math.floor((gridRows - 1) / 2)
  const offsetX = center.x - Math.floor(center.x / PIXELS_PER_TILE) * PIXELS_PER_TILE
  const offsetY = center.y - Math.floor(center.y / PIXELS_PER_TILE) * PIXELS_PER_TILE
  const centerGridX = centerCol * PIXELS_PER_TILE + offsetX
  const centerGridY = centerRow * PIXELS_PER_TILE + offsetY
  return globalPixelToLatLon(
    center.x + (px - centerGridX),
    center.y + (py - centerGridY),
    zoom
  )
}

// Decodes a Google/Valhalla encoded polyline. Default precision matches
// Valhalla's polyline6 shape format.
// Adapted from https://github.com/DennisOSRM/Project-OSRM-Web (BSD-2-Clause)
export function decodePolyline (str, precision = 6) {
  let index = 0
  let lat = 0
  let lng = 0
  let shift, result, byte
  const factor = Math.pow(10, precision)
  const coordinates = []
  while (index < str.length) {
    shift = 0; result = 0
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do {
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dLat
    lng += dLng
    coordinates.push([lat / factor, lng / factor])
  }
  return coordinates
}

// Build SVG markup for the portion of a polyline crossing one tile.
// Returns '' when there are no coordinates.
export function generateRouteSVG (coordinates, zoom, tileX, tileY) {
  if (!coordinates?.length) return ''
  const d = coordinates.map((c, i) => {
    const p = latLonToTilePixel(c[0], c[1], zoom, tileX, tileY)
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
  return `<svg class="route-overlay" width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <path d="${d}" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />
  <path d="${d}" fill="none" stroke="#0066ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
</svg>`
}

// Build an N x N grid of tile descriptors centered on (latitude, longitude).
// Each cell is `{ tileUrl, route }` where `route` is '' (no overlay) or an
// SVG string. Pass `polylineCoordinates: null` to skip the overlay entirely.
export function buildTileGrid ({
  latitude,
  longitude,
  zoom,
  rows = 5,
  cols = 5,
  polylineCoordinates = null
}) {
  const { tile: tileX, pixelsOffset: xPart } = lon2tile(longitude, zoom)
  const { tile: tileY, pixelsOffset: yPart } = lat2tile(latitude, zoom)
  const grid = []
  for (let i = 0; i < rows; i++) {
    const row = []
    for (let j = 0; j < cols; j++) {
      const x = j + tileX - Math.floor((cols - 1) / 2)
      const y = i + tileY - Math.floor((rows - 1) / 2)
      const tileUrl = USGS_TILE_URL.replace('{z}', zoom).replace('{x}', x).replace('{y}', y)
      const route = polylineCoordinates ? generateRouteSVG(polylineCoordinates, zoom, x, y) : ''
      row.push({ tileUrl, route })
    }
    grid.push(row)
  }
  const scale = KM_PER_PX_AT_ZOOM_0 / Math.pow(2, zoom)
  return {
    mapTileGrid: grid,
    scale,
    offset: { x: xPart, y: yPart },
    gridSize: { rows, cols }
  }
}
