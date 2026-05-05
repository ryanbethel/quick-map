// POST /c — finalize the session draft into a saved collection in DDB,
// then redirect to /c/{id}. The id is a small UUID; we keep TTL relatively
// long (30 days) since this is a demo and there's nothing privacy-sensitive.

import { randomUUID } from 'node:crypto'
import data from '@begin/data'

const TTL_SECONDS = 30 * 24 * 60 * 60

export async function post (req) {
  const draftPins = Array.isArray(req.session?.draftPins) ? req.session.draftPins : []
  if (draftPins.length === 0) {
    return {
      session: { ...req.session, collectionFlash: 'Add at least one pin before saving.' },
      location: '/c/new'
    }
  }

  const title = (req.body?.title || '').trim().slice(0, 80)
  const id = randomUUID().slice(0, 8)

  try {
    await data.set({
      table: 'collections',
      key: id,
      title,
      pins: draftPins,
      ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS
    })
  } catch (e) {
    console.log('[collections] save failed:', e.message)
    return {
      session: { ...req.session, collectionFlash: `Could not save collection (${e.message}).` },
      location: '/c/new'
    }
  }

  const { draftPins: _drop, collectionFlash, ...cleanSession } = req.session || {}
  return {
    session: cleanSession,
    location: `/c/${id}`
  }
}
