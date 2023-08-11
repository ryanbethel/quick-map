export default function map({html,state}){
  const { mapTileGrid, latitude, longitude, zoom, scale, offset, gridSize, zipcode} = state.store
  return html`
<style scope=global>
  body {
    margin: 0;
    width: 100vw;
    height: 100dvh; 
    overflow: hidden;
  }
</style>

<style>

.mapGridContainer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80dvh; /* Viewport height */ 
  overflow: hidden;
}

.zoomControls {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 5px;
  border-radius: 5px;
}

.mapGrid {
  display: grid;
  grid-template-columns: repeat(${gridSize.rows}, 256px);
  gap: 0px;
}

img.map-tile {
  width: 256px;
  height: 256px;
  display: block;
}

.mapScale {
  position: absolute;
  bottom: 10px;
  right: 10px;
}

.marker {
  color: var(--primary);
  position: absolute;
  z-index: 10; 
  left: 50%;
  top: 50%;
  ${ offset && `transform: translate(${offset.x-256/2}px, ${offset.y-256/2}px); `}
}

.zoomControls > form {
  margin: 0;
}

.zoomControls > form > button {
  margin-bottom: 0;
}

.zipControls {
  display: grid;
  grid-template-columns: 1fr 1fr;
}




</style>

<div class="mapGridContainer">
  <div draggable="true" class="mapGrid">

    ${mapTileGrid ? mapTileGrid.map(row => row.map(col=> `<img class="map-tile" src="${col}" 
        loading="lazy" width="256" height="256">`).join('\n')).join('\n') : ''}

    <svg width="60" height="25" class="mapScale">
        <line x1="0" y1="10" x2="50" y2="10" stroke="black" stroke-width="2"/>
        <text x="25" y="25" font-family="Arial" font-size="12" fill="black" text-anchor="middle">${(
    scale * 50
  ).toFixed(2)} km</text>
    </svg>
  </div>
  <div class="zoomControls">
    <form action="/zoom/${Math.min(zoom+1,16)}/zip/${zipcode}" method="GET">
      <button class="secondary" type="submit">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-zoom-in" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
          <path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
          <path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/>
        </svg>
      </button>
    </form>
    <form action="/zoom/${Math.max(zoom-1,0)}/zip/${zipcode}" method="GET">
      <button class="secondary"   type="submit">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-zoom-out" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
          <path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
          <path fill-rule="evenodd" d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
        </svg>   
      </button>
    </form>
    <span>Zoom: ${zoom}</span>
  </div>
  <svg id="marker" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="marker text-primary bi bi-geo-alt-fill" viewBox="0 0 16 16">
    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  </svg>
</div>
<div class="mapControls">
  <form style="display:none;" id="geo-location-form" action="" method="GET">
    <button type=submit class="currentLocation">Find Me</button>
  </form>
  <form action="/zoom/${zoom}/zip" method="POST">
    <div class="zipControls" >
      <input class="form-control" name="zipcode" type="text" id="zipcode" value="${zipcode}" placeholder="Enter Zipcode">
      <button class="secondary" type="submit" id="getZip">Get Zip Code</button>
    </div>
  </form>
</div>


<script type="module">

  const geoForm = document.getElementById('geo-location-form');
  geoForm.style.display='block';
  geoForm.addEventListener("submit", handleGeoSubmit);

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            reject(error);
          }
        );
      } else {
        reject(new Error("Geolocation is not supported by this browser."));
      }
    });
  }
      
  async function handleGeoSubmit(event) {
    event.preventDefault();
    const geoLocation = await getCurrentLocation();
    window.location.assign('/zoom/${zoom}'+'/lat/'+geoLocation.latitude+'/lon/'+geoLocation.longitude)
  }


 // const draggable = document.querySelector('.mapGrid[draggable="true"]');
 //  draggable.addEventListener('dragstart', function(event) {
 //    console.log("dragging")
 //    draggable.addEventListener('dragend', (event)=>{
 //      console.log(event)
 //      console.log(event.x,event.y)
 //    })
 //  })

</script>
`}
