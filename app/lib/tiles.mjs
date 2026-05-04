// Shared map-tile / Web-Mercator helpers used by the map and directions routes.
// Pure functions, no I/O.

export const PIXELS_PER_TILE = 256
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
