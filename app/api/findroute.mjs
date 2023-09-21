export async function post(req){

  const address = req.body?.address || ''

  const nominatimUrl = (address='')=>`https://nominatim.openstreetmap.org/search?addressdetails=1&q=${encodeURIComponent(address)}&format=jsonv2&limit=1`
  const destination = await fetch(nominatimUrl(address)) 
  let directions = {}
  if (.ok) {
    data = await api.json();
  }


  const routingUrl = (location = {})=> `https://valhalla1.openstreetmap.de/route?json={"locations":[ {"lat":${location.start?.lat,"lon": ${location.start?.lon}}, {"lat":${location.end?.lat),"lon": ${location.end?.lon}} ],"costing":"auto"}`
  const api = await fetch(myUrl) 
  let data = {}
  console.log({api})
  if (api.ok) {
    data = await api.json();
    console.log({data});
  }

  console.log(data.trip.legs);
  console.log(decodePolyline(data?.trip?.legs?.[0]?.shape),6)

  const coordinates = [
    [40.748817, -73.985428],
    [50.749817, -73.984428],
  // ... add more coordinates
  ];
  const zoom = 2;
  const tileX = 1;  // Example tile X for the given coordinates and zoom level
  const tileY = 1;  // Example tile Y for the given coordinates and zoom level

  const svgOverlay = generateSVGOverlay(coordinates, zoom, tileX, tileY);

  console.log(svgOverlay);
  // console.log(directions)
  // return {json:data}
  return {html:svgOverlay}
  

}


// This is adapted from the implementation in Project-OSRM
// https://github.com/DennisOSRM/Project-OSRM-Web/blob/master/WebContent/routing/OSRM.RoutingGeometry.js

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
            <image href="https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png" width="256" height="256" />
            <path d="${pathData}" fill="none" stroke="blue" stroke-width="2" />
        </svg>
    `;

  return svg;
}
