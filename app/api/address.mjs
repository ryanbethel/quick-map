export async function post(req){
  const address = req.body?.search_address || ''

  if (address) {
    let data
    try {
      const nominatimUrl = (address='')=>`https://nominatim.openstreetmap.org/search?addressdetails=1&q=${encodeURIComponent(address)}&format=jsonv2&limit=1`
      const destination = await fetch(nominatimUrl(address)) 
      data = await destination.json();
    } catch (e) {
      console.log(e);
    }
    const coordinates = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon)
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
