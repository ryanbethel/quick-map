const urlTemplate = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}";
export async function get(req){

  const session = req.session
  let zoom,latitude,longitude
  latitude = parseFloat(req.query.latitude) || session.latitude || 38.9072
  longitude = parseFloat(req.query.longitude) || session.longitude || -77.0369
  zoom = parseInt(req.query.zoom) || session.zoom || 15
  
  const newSession = {zoom,latitude,longitude}


  function lon2tile(lon, zoom) {
    const value = ((lon + 180) / 360) * Math.pow(2, zoom);
    const tile = Math.floor(value);
    const fraction = value - tile;
    return {
      tile: tile,
      percentage: fraction * 100
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
      percentage: fraction * 100
    };
  }
  // function lon2tile(lon, zoom) {
  //   return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  // }

  // function lat2tile(lat, zoom) {
  //   return Math.floor(
  //     ((1 -
  //     Math.log(
  //       Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
  //     ) /
  //       Math.PI) /
  //     2) *
  //     Math.pow(2, zoom)
  //   );
  // }
  const { tile:tileX, percentage:xPart} = lon2tile(longitude,zoom)
  const { tile:tileY, percentage:yPart} = lat2tile(latitude,zoom)
  let mapTileGrid = []
  // Assumes odd number of rows and cols so there is a center tile
  const rows = 3;
  const cols = 3;
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

  return {
    session: newSession,
    json: { mapTileGrid, latitude, longitude, zoom, scale, offset:{x:xPart,y:yPart} },
  }

}

export async function post(req){
  const {zoomIn = false, zoomOut = false, zipCode=false} = req.body
  let zoom = req.session.zoom || 10
  if (zoomIn) zoom += 1
  if (zoomOut) zoom -= 1
  let data
  if (zipCode) {
    try {
      const response = await fetch('https://api.zippopotam.us/us/'+zipCode);
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
  return {
    session: {...req.session, zoom},
    location: '/'
  }
}
