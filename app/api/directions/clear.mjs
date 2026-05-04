import data from '@begin/data'

export async function post (req) {
  const { routeId, directions, ...rest } = req.session
  if (routeId) {
    data.destroy({ table: 'routes', key: routeId }).catch(err => {
      console.log('[clear] route destroy failed:', err.message)
    })
  }
  return {
    session: rest,
    location: '/'
  }
}
