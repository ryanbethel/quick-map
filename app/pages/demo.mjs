// app/pages/demo.mjs — kitchen-sink demo. Every component, every execution
// mode, and the two state-sharing patterns that work without an in-place
// tile swap (iframe target=, and standalone components that emit events).
//
// Interactive maps are wrapped in <iframe src="/demo/embed"> so they can
// own their URL. Static thumbnails / previews use <map-thumbnail> directly
// so they ship zero JS.

export default function Demo ({ html }) {
  return html`
<style scope=global>
  html, body { margin: 0; }
  body {
    font: 14px/1.4 system-ui, -apple-system, sans-serif;
    color: #111;
    background: #f7f7f7;
  }
  * { box-sizing: border-box; }
</style>

<style>
  .demo {
    max-width: 1080px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }
  .demo h1 {
    font-size: 22px;
    margin: 0 0 6px;
  }
  .demo .lede {
    color: #555;
    margin: 0 0 28px;
  }
  .demo section {
    background: #fff;
    border: 1px solid #e2e2e2;
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 20px;
  }
  .demo section > h2 {
    margin: 0 0 4px;
    font-size: 16px;
  }
  .demo section > p {
    margin: 0 0 14px;
    color: #555;
    font-size: 13px;
  }
  .demo .row {
    display: grid;
    gap: 16px;
    align-items: start;
  }
  .demo .cols-3 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .demo .cols-2 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  @media (max-width: 720px) { .demo .cols-2 { grid-template-columns: 1fr; } }

  .demo iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .demo .full-map {
    height: 380px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #d0d0d0;
    background: #e8e8e8;
  }
  .demo .small-map {
    width: 320px;
    height: 200px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #d0d0d0;
    background: #e8e8e8;
  }
  .demo .iframe-host {
    height: 320px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #d0d0d0;
  }
  .demo .panel-stack { display: grid; gap: 10px; }
  .demo h3 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #555;
    margin: 0 0 6px;
  }
  .demo .out {
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #f4f4f4;
    color: #333;
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap;
    word-break: break-all;
    min-height: 18px;
  }
  .demo .grid-thumbs {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .demo ul.with-icon { list-style: none; padding: 0; margin: 0; }
  .demo ul.with-icon li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .demo .pattern-tag {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #eef3ff;
    color: #1a44a8;
    font-size: 11px;
    font-weight: 600;
  }
  .demo code { font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; }
</style>

<div class="demo">
  <h1>Headless map components — kitchen sink</h1>
  <p class="lede">One page exercising every component and every execution mode (no-script / default / direct). Interactive maps are iframed so gestures and resize navigate the map's own page rather than this host.</p>

  <section>
    <h2>Full editor <span class="pattern-tag">chrome + click-to-drop pins</span></h2>
    <p>The hero is <code>&lt;iframe src=&quot;/c/new&quot;&gt;</code> — the same page <code>&lt;usgs-map&gt;</code> renders for collection editing. Built-in nav, info panel, scale, crosshair are all on; clicking the map opens the &ldquo;new pin&rdquo; dialog. Drop a few pins, hit &ldquo;Save collection&rdquo;, and you're at <code>/c/&#123;id&#125;</code> with a real shareable URL.</p>
    <div class="full-map">
      <iframe src="/c/new" title="Click to drop pins"></iframe>
    </div>
  </section>

  <section>
    <h2>Group of pins, bbox-fitted <span class="pattern-tag">SSR fit</span></h2>
    <p>The embed page (<code>/demo/embed</code>) hardcodes four pins around Portland, ME. With no <code>?lat/lon/zoom</code> in the URL the API computes a bbox-fit center + zoom (using the iframe's measured <code>w</code>/<code>h</code> when JS is on, or grid-tile padding for the no-JS first paint), so all pins always land inside the visible area regardless of the iframe's size.</p>
    <div class="full-map">
      <iframe src="/demo/embed" title="Pin group fitted"></iframe>
    </div>
  </section>

  <section>
    <h2>Route on a map, fitted to bounds <span class="pattern-tag">polyline overlay</span></h2>
    <p>The <code>/demo/route</code> handler calls <code>fetchRoute()</code> server-side (Valhalla → OSRM → straight-line fallback chain) for Portland, ME → Augusta, ME, then passes the decoded coordinates as <code>state.store.polylineCoordinates</code>. The route is rendered as per-tile SVG overlays — no client-side mapping library, just plain HTML+SVG. <code>bboxCenterAndZoom</code> picks the center+zoom that fits the whole polyline.</p>
    <div class="full-map">
      <iframe src="/demo/route" title="Route fitted to bbox"></iframe>
    </div>
  </section>

  <section>
    <h2>Fixed-size container <span class="pattern-tag">sizing regression test</span></h2>
    <p>Same group-of-pins map at 320×200. Pins must stay inside the box (this is the off-screen-pin bug that <code>?fit=1</code> + <code>ResizeObserver</code> fix).</p>
    <div class="small-map">
      <iframe src="/demo/embed" title="Fixed-size demo map"></iframe>
    </div>
  </section>

  <section>
    <h2>Iframe map driven by external controls <span class="pattern-tag">target=&quot;map&quot;</span></h2>
    <p>The iframe and the controls are siblings. Forms have <code>target=&quot;map&quot;</code>, so submissions navigate only the iframe. Works without JS.</p>
    <div class="row cols-2">
      <div class="iframe-host">
        <iframe name="map" src="/demo/embed" title="Embedded map"></iframe>
      </div>
      <div class="panel-stack">
        <h3>Address search → iframe</h3>
        <address-search target="map" action="/api/geocode" zoom="13" placeholder="Search anywhere"></address-search>

        <h3>Manual nav</h3>
        <map-nav target="map" base-url="/demo/embed" lat="43.66" lon="-70.25" zoom="12" cols="5" rows="5" locate="false"></map-nav>

        <h3>Presets</h3>
        <ul class="with-icon">
          <li><a href="/demo/embed?lat=37.77&amp;lon=-122.42&amp;zoom=12" target="map">San Francisco</a></li>
          <li><a href="/demo/embed?lat=40.7&amp;lon=-74.0&amp;zoom=12" target="map">New York</a></li>
          <li><a href="/demo/embed?fit=1" target="map">Re-fit pins</a></li>
        </ul>
      </div>
    </div>
  </section>

  <section>
    <h2>Search components — three modes side-by-side</h2>
    <p>All three modes share the same form contract; they differ only in what runs when JS is on. Submitting fires <code>geocode:result</code> events you can wire up however you like.</p>
    <div class="row cols-3">
      <div>
        <h3>no-script</h3>
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">Pure HTML form. Submitting navigates.</p>
        <address-search no-script action="/api/geocode" placeholder="No-JS search"></address-search>
      </div>
      <div>
        <h3>default (progressive)</h3>
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">Form + fetch hijack to /api/geocode.</p>
        <address-search action="/api/geocode" placeholder="Fetch search" id="search-default"></address-search>
        <div class="out" id="search-default-out">Listening for geocode:result...</div>
      </div>
      <div>
        <h3>mode=&quot;direct&quot;</h3>
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">Calls Nominatim from the browser. No server.</p>
        <address-search mode="direct" placeholder="Direct search" id="search-direct"></address-search>
        <div class="out" id="search-direct-out">Listening for geocode:result...</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Route search</h2>
    <p>Two address inputs → returns a polyline + maneuvers.</p>
    <div class="row cols-2">
      <div class="panel-stack">
        <h3>default (fetch)</h3>
        <route-search action="/api/route" id="route-default"></route-search>
        <div class="out" id="route-default-out">Listening for route:result...</div>
      </div>
      <div class="panel-stack">
        <h3>mode=&quot;direct&quot; (OSRM)</h3>
        <route-search mode="direct" engine="osrm" id="route-direct"></route-search>
        <div class="out" id="route-direct-out">Listening for route:result...</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Standalone scale + thumbnails + icons</h2>
    <p><code>&lt;map-scale&gt;</code>, <code>&lt;map-thumbnail&gt;</code>, and <code>&lt;map-icon&gt;</code> all ship zero JS — drop them anywhere.</p>
    <div class="grid-thumbs">
      <map-thumbnail lat="43.66" lon="-70.25" zoom="11">
        <map-pin lat="43.66" lon="-70.25"></map-pin>
      </map-thumbnail>
      <map-thumbnail lat="37.77" lon="-122.42" zoom="11" width="200" height="120">
        <map-pin lat="37.77" lon="-122.42"></map-pin>
      </map-thumbnail>
      <map-thumbnail lat="40.0" lon="-105.27" zoom="9" width="240" height="160"></map-thumbnail>
    </div>

    <h3 style="margin-top: 16px;">Scale</h3>
    <map-scale zoom="11" lat="44.31" width="80"></map-scale>

    <h3 style="margin-top: 16px;">Map icons</h3>
    <ul class="with-icon">
      <li><map-icon size="16"></map-icon> 16 px</li>
      <li><map-icon size="24"></map-icon> 24 px (default)</li>
      <li><map-icon size="32" pin="false"></map-icon> 32 px, no pin</li>
      <li><map-icon size="48"></map-icon> 48 px</li>
    </ul>
  </section>
</div>

<script type="module">
  function show (id, label, evt) {
    const el = document.getElementById(id)
    if (!el) return
    const d = evt.detail || {}
    el.textContent = label + ': ' + JSON.stringify(d, null, 2)
  }
  for (const [id, outId] of [
    ['search-default', 'search-default-out'],
    ['search-direct', 'search-direct-out']
  ]) {
    const el = document.getElementById(id)
    if (!el) continue
    el.addEventListener('geocode:result', e => show(outId, 'result', e))
    el.addEventListener('geocode:error', e => show(outId, 'error', e))
  }
  for (const [id, outId] of [
    ['route-default', 'route-default-out'],
    ['route-direct', 'route-direct-out']
  ]) {
    const el = document.getElementById(id)
    if (!el) continue
    el.addEventListener('route:result', e => {
      const d = e.detail || {}
      const summary = {
        coords: (d.coordinates || []).length,
        maneuvers: (d.maneuvers || []).length,
        start: d.start?.displayName,
        end: d.end?.displayName
      }
      const out = document.getElementById(outId)
      if (out) out.textContent = 'result: ' + JSON.stringify(summary, null, 2)
    })
    el.addEventListener('route:error', e => show(outId, 'error', e))
  }
</script>
`
}
