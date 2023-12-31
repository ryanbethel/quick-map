import data from '@begin/data'
const urlTemplate = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}";
const pixelsPerTile = 256


function pixelsPerDegree(zoom){
  const totalLongitude = 360 // degrees around the earth
  const totalLatitude = 85.05112878*2 // degrees clipped at poles 
  const numberOfTiles = Math.pow(2,zoom)
  return {
    pixelsPerDegreeLongitude: pixelsPerTile * numberOfTiles / totalLongitude,
    pixelsPerDegreeLatitude: pixelsPerTile * numberOfTiles / totalLatitude
  }
}
export async function get(req){

  const zoom = parseInt(req.params.zoom) 
  const zipcode = req.params.zipcode 
  let latitude,longitude
  try {
    const zipData = await data.get({table:'zip', key:zipcode})
    latitude = zipData.latitude
    longitude = zipData.longitude
  } catch (e) {
    console.log(e)
  }


  let result;
  if (!latitude || !longitude){
    try {
      const response = await fetch('https://api.zippopotam.us/us/'+zipcode);
      result = await response.json();
    } catch (e) {
      console.log(e);
    }
    latitude= parseFloat(result.places[0].latitude)
    longitude= parseFloat(result.places[0].longitude)
    await data.set({table:'zip', key:zipcode, latitude, longitude})
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
      row.push(tileUrl);
    }
    mapTileGrid.push(row);
  }
  const baseLength = 40075 / 256; // km/px for zoom 0
  const scale = baseLength / Math.pow(2, zoom);

  const {latitude:removeLat, longitude:removeLon, ...newSession} = req.session
  return {
    session: {...newSession, zoom, zipcode},
    json: { mapTileGrid, latitude, longitude, zoom, scale, offset:{x:xPart,y:yPart},gridSize:{rows,cols}, zipcode },
  }

}

export async function post(req){
  const {zoomIn = false, zoomOut = false, zipcode=false, latitude='', longitude=''} = req.body
  let zoom = req.session.zoom || 10
  if (zoomIn && zoom < 16 ) zoom = zoom + 1
  if (zoomOut && zoom > 0) zoom = zoom - 1
  let data
  if (zipcode) {
    try {
      const response = await fetch('https://api.zippopotam.us/us/'+zipcode);
      data = await response.json();
    } catch (e) {
      console.log(e);
    }
    const coordinates = {
      latitude: parseFloat(data.places[0].latitude),
      longitude: parseFloat(data.places[0].longitude)
    };
    return {
      session: {...req.session, ...coordinates},
      location: '/'
    }
  }

  if (latitude && longitude) {
    return {
      session: {...req.session, latitude:parseFloat(latitude), longitude:parseFloat(longitude)},
      location: '/'
    }
  }

  return {
    session: {...req.session, zoom},
    location: '/'
  }
}
