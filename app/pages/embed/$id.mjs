// app/pages/embed/$id.mjs — parent shell with an <iframe name="map"> that
// hosts /c/$id. Sidebar links and forms use target="map" so only the
// embedded map navigates; the surrounding header / sidebar / page chrome
// stays put without any JS.

export default function EmbedPage ({ html, state }) {
  const store = state?.store || {}
  const collectionId = store.collectionId || ''
  const title = store.collectionTitle || ''
  const pins = Array.isArray(store.pins) ? store.pins : []
  const mapUrl = `/c/${encodeURIComponent(collectionId)}`

  return html`
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 14px/1.4 system-ui, -apple-system, sans-serif;
    background-color: #f3f3f3;
  }
  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    grid-template-rows: 56px 1fr;
    height: 100dvh;
    gap: 1px;
    background-color: #cccccc;
  }
  header {
    grid-column: 1 / 3;
    background-color: #ffffff;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
  }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  header .grow { flex: 1; }
  header a {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid #cccccc;
    border-radius: 9999px;
    background-color: #ffffff;
    color: #111111;
    font-size: 13px;
    text-decoration: none;
  }
  aside {
    background-color: #ffffff;
    overflow: auto;
    padding: 16px;
  }
  aside h2 {
    font-size: 11px;
    margin: 0 0 8px 0;
    color: #555555;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }
  aside h2:not(:first-child) { margin-top: 18px; }
  aside ul { list-style: none; padding: 0; margin: 0; }
  aside li { margin-bottom: 4px; }
  aside li a,
  aside form button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid #dddddd;
    border-radius: 6px;
    background-color: #ffffff;
    color: #111111;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  aside li a:hover,
  aside form button:hover { background-color: #f4f4f4; }
  aside form {
    display: grid;
    gap: 6px;
    margin: 0;
  }
  aside form input {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: 1px solid #cccccc;
    border-radius: 6px;
    font: inherit;
  }
  main { background-color: #ffffff; }
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .meta { color: #666666; font-size: 12px; }
</style>

<div class="layout">
  <header>
    <h1>${escapeText(title || 'Collection')}</h1>
    <span class="meta">${pins.length} pin${pins.length === 1 ? '' : 's'}</span>
    <span class="grow"></span>
    <a href="${mapUrl}" target="map">Reset map</a>
    <a href="${mapUrl}" target="_blank" rel="noopener">Open standalone &#8599;</a>
  </header>

  <aside>
    <h2>Pins</h2>
    <ul>
      ${pins.map(p => `
        <li>
          <a href="${mapUrl}?lat=${p.lat}&lon=${p.lon}&zoom=14" target="map">
            ${escapeText(p.name || `${Number(p.lat).toFixed(3)}, ${Number(p.lon).toFixed(3)}`)}
          </a>
        </li>
      `).join('')}
    </ul>

    <h2>Presets</h2>
    <ul>
      <li><a href="${mapUrl}?lat=39.5&lon=-98&zoom=4" target="map">United States</a></li>
      <li><a href="${mapUrl}?lat=43.68&lon=-70.25&zoom=11" target="map">Portland, ME</a></li>
      <li><a href="${mapUrl}?lat=37.77&lon=-122.42&zoom=12" target="map">San Francisco</a></li>
    </ul>

    <h2>Jump to coords</h2>
    <form action="${mapUrl}" method="GET" target="map">
      <input type="text" name="lat" placeholder="lat" inputmode="decimal" required>
      <input type="text" name="lon" placeholder="lon" inputmode="decimal" required>
      <input type="number" name="zoom" placeholder="zoom" min="0" max="16" value="13">
      <button type="submit">Go</button>
    </form>
  </aside>

  <main>
    <iframe name="map" title="${escapeText(title || 'Map')}" src="${mapUrl}"></iframe>
  </main>
</div>
`
}

function escapeText (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
