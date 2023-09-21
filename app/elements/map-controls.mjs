export default function mapControls({html,state}){
  const { mapTileGrid, latitude, longitude, zoom, scale, offset, gridSize} = state.store
  return html`
<style>

.zoomControls {
  position: absolute;
  bottom: 40px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 5px;
  border-radius: 5px;
}

.zoomControls > form {
  margin: 0;
}

.zoomControls > form > button {
  margin-bottom: 0;
}

</style>


  <div class="zoomControls ">
    <form action="/zoom/${Math.min(zoom+1,16)}/lat/${latitude}/lon/${longitude}" method="GET">
      <button class="secondary" type="submit">
        <svg xmlns="http://www.w3.org/2000/svg" width=24 height=24 fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </form>
    <form action="/zoom/${Math.max(zoom-1,0)}/lat/${latitude}/lon/${longitude}" method="GET">
      <button class="secondary" type="submit">
        <svg xmlns="http://www.w3.org/2000/svg" width=24 height=24 fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </form>
    <form class="geo-location-form">
      <button type=submit class="find-me">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256"><path d="M229.33,98.21,53.41,33l-.16-.05A16,16,0,0,0,32.9,53.25a1,1,0,0,0,.05.16L98.21,229.33A15.77,15.77,0,0,0,113.28,240h.3a15.77,15.77,0,0,0,15-11.29l23.56-76.56,76.56-23.56a16,16,0,0,0,.62-30.38ZM224,113.3l-76.56,23.56a16,16,0,0,0-10.58,10.58L113.3,224h0l-.06-.17L48,48l175.82,65.22.16.06Z"></path></svg>
      </button>
    </form>
  </div>

<script type="module">
class MapControl extends HTMLElement {
  constructor(){
    super();
    this.zoom = ${zoom};
    this.handleGeoSubmit = this.handleGeoSubmit.bind(this);
  }

  connectedCallback(){
    console.log('MapControl connected')
    this.geoForm = this.querySelector('form.geo-location-form');
    console.log(this.geoForm)
    this.geoForm.style.display='block';
    this.geoForm.addEventListener("submit", this.handleGeoSubmit);

  }

  async handleGeoSubmit(event) {
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
    console.log('handleGeoSubmit')
    event.preventDefault();
    const geoLocation = await getCurrentLocation();
    window.location.assign('/zoom/${zoom}'+'/lat/'+geoLocation.latitude+'/lon/'+geoLocation.longitude)
  }
}

customElements.define('map-controls',MapControl)
</script>
`}
