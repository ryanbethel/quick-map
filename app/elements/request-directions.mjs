export default function requestDirections({html,state}){
  return html`
<style>

button {
  background-color: var(--primary-400);
            padding: 5px 10px;
            font-size: 16px;
            cursor: pointer;
        }
button svg {
            display: inline-block;
            vertical-align: middle;
            width: 20px; /* Adjust as needed */
            height: 20px; /* Adjust as needed */
            margin-right: 8px; /* Space between the icon and the text */
        }

        button span {
            display: inline-block;
            vertical-align: middle;
        }

</style>


  <form action="/directions" method="POST">
    <input type="hidden" name="start_lat" value=${state.store?.latitude}>
    <input type="hidden" name="start_lon" value=${state.store?.longitude}>
    <input type="hidden" name="end_lat" value=${state.store?.latitude}> 
    <input type="hidden" name="end_lon" value=${state.store?.longitude}>
    <button class="radius-pill border-current border1 border-solid" type=submit><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#000000" viewBox="0 0 256 256"><path d="M200,168a32.06,32.06,0,0,0-31,24H72a32,32,0,0,1,0-64h96a40,40,0,0,0,0-80H72a8,8,0,0,0,0,16h96a24,24,0,0,1,0,48H72a48,48,0,0,0,0,96h97a32,32,0,1,0,31-40Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,200,216Z"></path></svg>
    <span>Directions</span></button>
  </form>
<script type="module">
class RequestDirections extends HTMLElement {
  constructor(){
    super();
    this.handleDirections = this.handleDirections.bind(this);
  }

  connectedCallback(){
    this.directionsForm = this.querySelector('form');
    this.directionsForm.style.display='block';
    this.directionsForm.addEventListener("submit", this.handleDirections);
    this.endLat = this.querySelector('input[name="end_lat"]');
    this.endLon = this.querySelector('input[name="end_lon"]');
  }

  async handleDirections(event) {
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
    event.preventDefault();
    const geoLocation = await getCurrentLocation();
    this.endLat.value = geoLocation.latitude;
    this.endLon.value = geoLocation.longitude;
    this.directionsForm.submit();
  }
}

customElements.define('request-directions',RequestDirections)
</script>
  `
}
