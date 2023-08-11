export async function post(req){
  const zipcode = req.body.zipcode
  const zoom = req.params.zoom

  return {
    status:302,
    location: '/zoom/'+zoom+'/zip/'+zipcode
  }
}
