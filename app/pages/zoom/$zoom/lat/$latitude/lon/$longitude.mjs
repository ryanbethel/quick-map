export default function map ({ html, state }) {
  const { mapTileGrid, zoom, scale, offset, gridSize, flash } = state.store
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
    height: 100dvh;
    overflow: hidden;
  }

  .mapGrid {
    display: grid;
    grid-template-columns: repeat(${gridSize.cols}, 256px);
    gap: 0;
  }

  .tile-container {
    position: relative;
    width: 256px;
    height: 256px;
  }

  .tile-container img,
  .tile-container svg {
    position: absolute;
    top: 0;
    left: 0;
  }

  img.map-tile {
    width: 256px;
    height: 256px;
    display: block;
  }

  /* Make sure the route SVG sits above the tile image but below the marker. */
  .tile-container svg.route-overlay {
    z-index: 5;
    pointer-events: none;
  }

  .mapScale {
    position: absolute;
    min-height: 25px;
    background-color: rgba(255, 255, 255, 0.8);
    bottom: 10px;
    right: 10px;
  }

  address-search {
    position: absolute;
    top: 0;
    left: 0;
  }

  .marker {
    color: #d62828;
    position: absolute;
    z-index: 10;
    left: 50%;
    top: 50%;
    ${offset && `transform: translate(${offset.x - 256 / 2}px, ${offset.y - 256 / 2}px);`}
  }

  request-directions {
    position: absolute;
    bottom: 20px;
    left: 10px;
    z-index: 15;
  }

  .flash {
    position: absolute;
    top: 64px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    max-width: 90dvw;
    padding: 8px 14px;
    background-color: #ffe9c2;
    color: #5b3a00;
    border: 1px solid #d4a64a;
    border-radius: 6px;
    font-size: 14px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
</style>

<div class="mapGridContainer">
  <div class="mapGrid">
    ${mapTileGrid ? mapTileGrid.map(row => row.map(col => `
      <div class="tile-container">
        <img class="map-tile" src="${col.tileUrl}" loading="lazy" width="256" height="256">
        ${col.route || ''}
      </div>
    `).join('')).join('') : ''}

    <div class="mapScale">
      <svg width="60" height="25">
        <line x1="0" y1="10" x2="50" y2="10" stroke="black" stroke-width="2"/>
        <text x="25" y="25" font-family="Arial" font-size="12" fill="black" text-anchor="middle">${(scale * 50).toFixed(2)} km</text>
      </svg>
    </div>
  </div>

  <map-controls></map-controls>

  <svg id="marker" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="marker" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  </svg>

  <request-directions></request-directions>
  <address-search></address-search>

  ${flash ? `<div class="flash" role="status">${flash}</div>` : ''}
</div>
`
}
