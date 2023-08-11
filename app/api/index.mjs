
export async function get(req){

  let {zoom=14,latitude,longitude, zipcode} = req.session

  if (zipcode){
    return {
      status:302,
      location: `/zoom/${zoom}/zip/${zipcode}`
    }
  } else if( latitude && longitude) {
    return {
      status:302,
      location: `/zoom/${zoom}/lat/${latitude}/lon/${longitude}`
    }
  } else {
    return {
      status:302,
      location: `/zoom/${zoom}/lat/43.68/lon/-70.25`
    }
  }
}

