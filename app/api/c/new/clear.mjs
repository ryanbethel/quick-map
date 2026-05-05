// POST /c/new/clear — wipe the in-progress draft pins from the session.

export async function post (req) {
  const { draftPins, collectionFlash, ...cleanSession } = req.session || {}
  return {
    session: cleanSession,
    location: '/c/new'
  }
}
