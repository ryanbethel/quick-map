export default function map({html,state}){
  const { mapTileGrid, latitude, longitude, zoom, scale, offset, gridSize} = state.store
  return html`
<style scope=global>
  body {
    margin: 0;
    width: 100dvw;
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
  height: 100dvh; /* Viewport height */ 
  overflow: hidden;
}


.mapGrid {
  display: grid;
  grid-template-columns: repeat(${gridSize.rows}, 256px);
  gap: 0px;
}

.tile-container {
    position: relative;
    width: 256px;
    height: 256px;
}

.tile-container img, .tile-container svg {
    position: absolute;
    top: 0;
    left: 0;
}

img.map-tile {
  width: 256px;
  height: 256px;
  display: block;
}

.mapScale {
  position: absolute;
  min-height: 25px;
  background-color: rgba(255, 255, 255, 0.7);
  bottom: 10px;
  right: 10px;
}

address-search {
  position: absolute;
  top:0;
}

.marker {
  color: var(--primary-600);
  position: absolute;
  z-index: 10; 
  left: 50%;
  top: 50%;
  ${ offset && `transform: translate(${offset.x-256/2}px, ${offset.y-256/2}px); `}
}

request-directions {
  /* visibility: hidden; */
  position: absolute;
  bottom: 20px;
  left: 10px;
}



.zipControls {
  display: grid;
  grid-template-columns: 1fr 1fr;
}


</style>

<div class="mapGridContainer">
  <div draggable="true" class="mapGrid">

    ${mapTileGrid ? mapTileGrid.map(row => row.map(col=> `
      <div class="tile-container">
        <img class="map-tile" src="${col.tileUrl}" loading="lazy" width="256" height="256">
        ${col.route || ''}
      </div>
    `).join('\n')).join('\n') : ''}

    <div class="mapScale">
      <svg width="60" height="25" >
          <line x1="0" y1="10" x2="50" y2="10" stroke="black" stroke-width="2"/>
          <text x="25" y="25" font-family="Arial" font-size="12" fill="black" text-anchor="middle">${(
    scale * 50
  ).toFixed(2)} km</text>
      </svg>
    </div>
  </div>
<map-controls></map-controls>

  <svg id="marker" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="marker text-primary bi bi-geo-alt-fill" viewBox="0 0 16 16">
    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  </svg>


  <request-directions></request-directions>
  <address-search></address-search>
</div>

<div class="mapControls">
  <form style="display:none;" id="geo-location-form" action="" method="GET">
    <button type=submit class="btn btn-primary currentLocation">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M229.33,98.21,53.41,33l-.16-.05A16,16,0,0,0,32.9,53.25a1,1,0,0,0,.05.16L98.21,229.33A15.77,15.77,0,0,0,113.28,240h.3a15.77,15.77,0,0,0,15-11.29l23.56-76.56,76.56-23.56a16,16,0,0,0,.62-30.38ZM224,113.3l-76.56,23.56a16,16,0,0,0-10.58,10.58L113.3,224h0l-.06-.17L48,48l175.82,65.22.16.06Z"></path></svg>
    </button>
  </form>
  <form action="/zoom/${zoom}/zip" method="POST">
    <div style="display:none;" class="zipControls">
      <input class="form-control" name="zipcode" type="text" id="zipcode" placeholder="Enter Zipcode">
      <button class="secondary" type="submit" id="getZip">Get Zip Code</button>
    </div>
  </form>
</div>


<script type="module">

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
