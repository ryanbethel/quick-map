// GET /embed/$id — host page that embeds a saved collection in an <iframe>.
// Demonstrates the iframe-targeting pattern: links/forms in the parent page
// have target="map", so submissions navigate only the embedded map and the
// outer chrome (header, sidebar, your-app's-shell) never reloads.

import data from '@begin/data'

export async function get (req) {
  const id = req.params?.id
  if (!id) return { status: 404, html: 'Missing collection id.' }

  let row
  try {
    row = await data.get({ table: 'collections', key: id })
  } catch (e) {
    console.log('[embed] load failed:', e.message)
    return { status: 500, html: 'Could not load collection.' }
  }

  if (!row || !Array.isArray(row.pins) || row.pins.length === 0) {
    return { status: 404, html: 'Collection not found or empty.' }
  }

  return {
    json: {
      collectionId: id,
      collectionTitle: row.title || '',
      pins: row.pins
    }
  }
}
