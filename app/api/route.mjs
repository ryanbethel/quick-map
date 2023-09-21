const urlTemplate = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}";
const pixelsPerTile = 256


export async function get(req){
  console.log(req.session)
  const {end_lat,end_lon,directions,zoom=10} = req.session

  const latitude = parseFloat(end_lat) 
  const longitude = parseFloat(end_lon) 

  const routeCoordinates = decodePolyline(directions.polyline)
  const { tile:tileX, pixelsOffset:xPart} = lon2tile(longitude,zoom)
  const { tile:tileY, pixelsOffset:yPart} = lat2tile(latitude,zoom)
  let mapTileGrid = []
  // Assumes odd number of rows and cols so there is a center tile
  const rows = 5;
  const cols = 5;
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      const x = Math.round(j + tileX - ((rows-1)/2));
      const y = Math.round(i + tileY - ((cols-1)/2));
      const tileUrl = urlTemplate
        .replace("{z}", zoom)
        .replace("{x}", x)
        .replace("{y}", y);
      row.push({tileUrl, route:generateSVGOverlay(routeCoordinates, zoom, x, y)});
    }
    mapTileGrid.push(row);
  }
  const baseLength = 40075 / 256; // km/px for zoom 0
  const scale = baseLength / Math.pow(2, zoom);

  const {zipcode:removeZip, ...newSession} = req.session
  return {
    session: {...newSession, latitude, longitude, zoom},
    json: { mapTileGrid, latitude, longitude, zoom, scale, offset:{x:xPart,y:yPart},gridSize:{rows,cols} },
  }

}

function lon2tile(lon, zoom) {
  const value = ((lon + 180) / 360) * Math.pow(2, zoom);
  const tile = Math.floor(value);
  const fraction = value - tile;
  return {
    tile: tile,
    pixelsOffset: fraction * pixelsPerTile
  };
}

function lat2tile(lat, zoom) {
  const value =
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
    Math.pow(2, zoom);
  const tile = Math.floor(value);
  const fraction = value - tile;
  return {
    tile: tile,
    pixelsOffset: fraction * pixelsPerTile
  };
}
function pixelsPerDegree(zoom){
  const totalLongitude = 360 // degrees around the earth
  const totalLatitude = 85.05112878*2 // degrees clipped at poles 
  const numberOfTiles = Math.pow(2,zoom)
  return {
    pixelsPerDegreeLongitude: pixelsPerTile * numberOfTiles / totalLongitude,
    pixelsPerDegreeLatitude: pixelsPerTile * numberOfTiles / totalLatitude
  }
}

function decodePolyline(str, precision) {
  var index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision || 6);

  // Coordinates have variable length when encoded, so just keep
  // track of whether we've hit the end of the string. In each
  // loop iteration, a single coordinate is decoded.
  while (index < str.length) {

    // Reset shift, result, and byte
    byte = null;
    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    shift = result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}





function latLonToTilePixel(lat, lon, zoom, tileX, tileY) {
  const n = Math.pow(2, zoom);
  const tileLat = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * (180 / Math.PI);
  const tileLon = tileX / n * 360 - 180;

  const pixelX = ((lon + 180) / 360 * n * 256) % 256;
  const pixelY = (256 / 2 - 256 * Math.log(Math.tan((Math.PI / 4) + (Math.PI / 2) * lat / 180)) / (2 * Math.PI)) % 256;

  return {
    x: pixelX - tileX * 256,
    y: pixelY - tileY * 256
  };
}

function generateSVGOverlay(coordinates, zoom, tileX, tileY) {
  const pathData = coordinates.map((coord, index) => {
    const point = latLonToTilePixel(coord[0], coord[1], zoom, tileX, tileY);
    return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
  }).join(' ');

  const svg = `
        <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <path d="${pathData}" fill="none" stroke="blue" stroke-width="2" />
        </svg>
    `;

  return svg;
}
