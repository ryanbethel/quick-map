// Nominatim (OpenStreetMap) geocoder.
//
// Usage policy requires a descriptive User-Agent and limits us to ~1 request
// per second. See https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT = 'quick-map/0.1 (https://github.com/ryanbethel/quick-map)'

export async function geocode (address) {
  const q = (address || '').trim()
  if (!q) return null

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&addressdetails=1`
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      'Accept-Language': 'en'
    }
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)

  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null

  const lat = parseFloat(data[0].lat)
  const lon = parseFloat(data[0].lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return {
    latitude: lat,
    longitude: lon,
    displayName: data[0].display_name || q
  }
}
