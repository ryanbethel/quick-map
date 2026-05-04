export default function mapControls({ html, state }) {
  const { latitude, longitude, zoom } = state.store
  return html`
<style>
  .zoomControls {
    position: absolute;
    bottom: 40px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background-color: rgba(255, 255, 255, 0.85);
    padding: 6px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .zoomControls > form {
    margin: 0;
  }

  .zoomControls button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    color: #111111;
    border: 1px solid #cccccc;
    border-radius: 6px;
    cursor: pointer;
  }

  .zoomControls button:hover {
    background-color: #f2f2f2;
  }

  .zoomControls button:active {
    background-color: #e6e6e6;
  }

  .zoomControls svg {
    width: 24px;
    height: 24px;
  }
</style>

<div class="zoomControls">
  <form action="/zoom/${Math.min(zoom + 1, 16)}/lat/${latitude}/lon/${longitude}" method="GET">
    <button type="submit" aria-label="Zoom in">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  </form>
  <form action="/zoom/${Math.max(zoom - 1, 0)}/lat/${latitude}/lon/${longitude}" method="GET">
    <button type="submit" aria-label="Zoom out">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  </form>
  <form class="geo-location-form">
    <button type="submit" class="find-me" aria-label="Find my location">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
        <path d="M229.33,98.21,53.41,33l-.16-.05A16,16,0,0,0,32.9,53.25a1,1,0,0,0,.05.16L98.21,229.33A15.77,15.77,0,0,0,113.28,240h.3a15.77,15.77,0,0,0,15-11.29l23.56-76.56,76.56-23.56a16,16,0,0,0,.62-30.38ZM224,113.3l-76.56,23.56a16,16,0,0,0-10.58,10.58L113.3,224h0l-.06-.17L48,48l175.82,65.22.16.06Z"></path>
      </svg>
    </button>
  </form>
</div>

<script type="module">
if (!customElements.get('map-controls')) {
  class MapControl extends HTMLElement {
    constructor () {
      super()
      this.zoom = ${zoom}
      this.handleGeoSubmit = this.handleGeoSubmit.bind(this)
    }

    connectedCallback () {
      this.geoForm = this.querySelector('form.geo-location-form')
      if (!this.geoForm) return
      this.geoForm.addEventListener('submit', this.handleGeoSubmit)
    }

    async handleGeoSubmit (event) {
      event.preventDefault()
      if (!navigator.geolocation) return
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
      })
      const { latitude, longitude } = pos.coords
      window.location.assign('/zoom/' + this.zoom + '/lat/' + latitude + '/lon/' + longitude)
    }
  }

  customElements.define('map-controls', MapControl)
}
</script>
`
}
