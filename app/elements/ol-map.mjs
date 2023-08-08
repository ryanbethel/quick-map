
export default function OlMap({html,state}){
  return html`
   <link rel="stylesheet" href="/_public/theme/ol.css">
    <style>
      :host {
        display: block;
      }
    </style>

    <div class="map-container" style="width:100%;height:100%;" ></div>
    <!-- Pointer events polyfill for old browsers, see https://caniuse.com/#feat=pointer -->
    <script src="https://cdn.jsdelivr.net/npm/elm-pep@1.0.6/dist/elm-pep.js"></script>
<script type="module">
import {Map,OSM,XYZ,TileLayer,View} from '/_public/browser/map.js'

class OlMap extends HTMLElement {
  constructor() {
    super();
    // this.shadow = this.attachShadow({mode: 'open'});
    // const link = document.createElement('link');
    // link.setAttribute('rel', 'stylesheet');
    // link.setAttribute('href', 'theme/ol.css');
    // this.shadow.appendChild(link);
    // const style = document.createElement('style');
    // style.innerText = \`
    //   :host {
    //     display: block;
    //   }
    // \`;
    // this.shadow.appendChild(style);
    // const div = document.createElement('div');
    // div.style.width = '100%';
    // div.style.height = '100%';
    // this.shadow.appendChild(div);

    const div = this.querySelector('div.map-container');
    this.map = new Map({
      target: div,
      layers: [
        new TileLayer({
      //  source: new OSM(),
          source: new XYZ({
            attributions: 'Map data: <a href="https://www.usgs.gov/">USGS</a>',
            url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
            tileSize: 256,
          }),
        }),
      ],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
    });
  }
}

customElements.define('ol-map', OlMap);
</script>
`}
