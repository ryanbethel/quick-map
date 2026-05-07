// <route-search>
//
// Headless start-and-end address pair for routing. Three execution modes:
//
//   no-script              → form posts to `action` (default /directions),
//                            server geocodes + routes + redirects.
//   (default, progressive) → form + script that fetch()es `action`
//                            (default /api/route), dispatches `route:result`.
//   mode="direct"          → script calls Nominatim then Valhalla/OSRM
//                            directly; no server required.
//
// See route-search.md for the full attribute / event reference.

export default function routeSearch ({ html, state }) {
  const attrs = state?.attrs || {}
  const store = state?.store || {}
  const mode = attrs.mode || ''
  const noScript = attrs['no-script'] != null
  const action = attrs.action || (mode === 'direct' ? '' : '/api/route')
  const method = (attrs.method || 'POST').toUpperCase()
  const target = attrs.target || ''
  const forId = attrs.for || ''
  const engine = (attrs.engine || 'valhalla').toLowerCase()
  // No-JS path falls back to /directions because the existing handler does
  // the session+DDB persistence the route overlay needs.
  const noScriptAction = attrs['no-script-action'] || '/directions'

  // Pre-fill from server-provided directions state (e.g., after a /directions
  // submit) so the form remembers the user's last query.
  const directions = store.directions || {}
  const startVal = attrs.start || directions.startAddress || ''
  const endVal = attrs.end || directions.endAddress || ''

  const formAction = noScript ? noScriptAction : action

  const form = /*html*/`
<form class="route-search-form"${target ? ` target="${escapeAttr(target)}"` : ''}
      action="${escapeAttr(formAction)}" method="${method}" autocomplete="off">
  <label class="route-search-row">
    <span class="route-search-label">Start</span>
    <input class="route-search-input" name="start_address" type="text"
           placeholder="Starting address" value="${escapeAttr(startVal)}" required>
  </label>
  <label class="route-search-row">
    <span class="route-search-label">End</span>
    <input class="route-search-input" name="end_address" type="text"
           placeholder="Destination address" value="${escapeAttr(endVal)}" required>
  </label>
  <div class="route-search-actions">
    ${directions.startAddress ? `<button type="submit" class="route-search-clear" formaction="/directions/clear" formnovalidate>Clear</button>` : ''}
    <button type="submit" class="route-search-submit">Get directions</button>
  </div>
</form>`

  const script = noScript ? '' : renderScript({ mode, action, forId, target, engine })

  return html`
<style scope="global">
  route-search {
    display: block;
    width: 100%;
  }
  route-search .route-search-form {
    margin: 0;
    display: grid;
    gap: 6px;
    padding: var(--route-search-padding, 8px);
    background-color: var(--route-search-bg, rgba(255, 255, 255, 0.95));
    border: 1px solid var(--route-search-border, #cccccc);
    border-radius: var(--route-search-radius, 8px);
    box-shadow: var(--route-search-shadow, 0 1px 4px rgba(0, 0, 0, 0.2));
    color: var(--route-search-fg, #111111);
    box-sizing: border-box;
  }
  route-search .route-search-row {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 6px;
    align-items: center;
  }
  route-search .route-search-label {
    font-size: 14px;
    color: var(--route-search-label-fg, #444444);
  }
  route-search .route-search-input {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    box-sizing: border-box;
    background-color: var(--route-search-input-bg, #ffffff);
    color: var(--route-search-input-fg, #111111);
    border: 1px solid var(--route-search-input-border, #cccccc);
    border-radius: var(--route-search-input-radius, 4px);
    font: inherit;
  }
  route-search .route-search-input::placeholder {
    color: var(--route-search-placeholder, #999999);
  }
  route-search .route-search-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    margin-top: 4px;
  }
  route-search .route-search-actions button {
    height: 32px;
    padding: 0 12px;
    background-color: var(--route-search-button-bg, #ffffff);
    color: var(--route-search-button-fg, #111111);
    border: 1px solid var(--route-search-button-border, #cccccc);
    border-radius: 9999px;
    font: inherit;
    cursor: pointer;
  }
  route-search .route-search-submit {
    background-color: var(--route-search-primary-bg, #0066ff) !important;
    color: var(--route-search-primary-fg, #ffffff) !important;
    border-color: var(--route-search-primary-bg, #0066ff) !important;
  }
  route-search .route-search-actions button:hover {
    filter: brightness(0.95);
  }
</style>
${form}
${script}
`
}

function renderScript ({ mode, action, forId, target, engine }) {
  const direct = mode === 'direct'
  return `
<script type="module">
if (!customElements.get('route-search')) {
  const ACTION = ${JSON.stringify(action)}
  const FOR_ID = ${JSON.stringify(forId)}
  const TARGET = ${JSON.stringify(target)}
  const ENGINE = ${JSON.stringify(engine)}
  const DIRECT = ${direct}

  // Decode a Google/Valhalla polyline. Default precision 6 (Valhalla).
  function decodePolyline (str, precision) {
    const factor = Math.pow(10, precision || 6)
    let index = 0, lat = 0, lng = 0
    const out = []
    while (index < str.length) {
      let shift = 0, result = 0, byte
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      lat += (result & 1) ? ~(result >> 1) : (result >> 1)
      shift = 0; result = 0
      do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      lng += (result & 1) ? ~(result >> 1) : (result >> 1)
      out.push([lat / factor, lng / factor])
    }
    return out
  }

  async function nominatim (address) {
    const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) +
      '&format=jsonv2&limit=1'
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!r.ok) throw new Error('Nominatim ' + r.status)
    const list = await r.json()
    const hit = Array.isArray(list) && list[0]
    if (!hit) return null
    return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), displayName: hit.display_name || address }
  }

  async function fetchValhalla (start, end) {
    const r = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [
          { lat: start.lat, lon: start.lon },
          { lat: end.lat, lon: end.lon }
        ],
        costing: 'auto'
      })
    })
    if (!r.ok) throw new Error('Valhalla ' + r.status)
    const body = await r.json()
    const leg = body?.trip?.legs?.[0]
    if (!leg?.shape) throw new Error('Valhalla returned no route')
    return {
      coordinates: decodePolyline(leg.shape, 6),
      maneuvers: (leg.maneuvers || []).map(m => m.instruction).filter(Boolean)
    }
  }

  async function fetchOSRM (start, end) {
    const url = 'https://router.project-osrm.org/route/v1/driving/' +
      start.lon + ',' + start.lat + ';' + end.lon + ',' + end.lat +
      '?overview=full&geometries=polyline&steps=true'
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!r.ok) throw new Error('OSRM ' + r.status)
    const body = await r.json()
    const route = body?.routes?.[0]
    if (!route?.geometry) throw new Error('OSRM returned no route')
    return {
      coordinates: decodePolyline(route.geometry, 5),
      maneuvers: (route.legs?.[0]?.steps || [])
        .map(s => s.maneuver?.type ? (s.name ? (s.maneuver.type + ' onto ' + s.name) : s.maneuver.type) : null)
        .filter(Boolean)
    }
  }

  class RouteSearch extends HTMLElement {
    connectedCallback () {
      this.form = this.querySelector('form.route-search-form')
      if (!this.form) return
      this.form.addEventListener('submit', e => this.onSubmit(e))
    }
    async onSubmit (e) {
      // Allow the explicit "Clear" button to submit naturally.
      if (e.submitter?.classList?.contains('route-search-clear')) return
      // Always intercept when JS is on. Letting the form submit naturally
      // to /api/route would 307 the iframe to /directions (legacy chrome).
      // Instead, fetch JSON and let the consumer decide what to do via
      // route:result.
      e.preventDefault()
      const target = this.getAttribute('target') || TARGET
      const fd = new FormData(this.form)
      const start = (fd.get('start_address') || '').toString().trim()
      const end = (fd.get('end_address') || '').toString().trim()
      if (!start || !end) return
      try {
        const result = DIRECT ? await this.directRoute(start, end) : await this.fetchRoute(start, end)
        if (!result) throw new Error('no route')
        this.dispatchEvent(new CustomEvent('route:result', { bubbles: true, detail: result }))
        this.deliver(result, target)
      } catch (err) {
        this.dispatchEvent(new CustomEvent('route:error', { bubbles: true, detail: { error: err.message } }))
      }
    }
    async fetchRoute (start, end) {
      const res = await fetch(this.getAttribute('action') || ACTION, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ start, end })
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.json()
    }
    async directRoute (startAddr, endAddr) {
      const [s, e] = await Promise.all([nominatim(startAddr), nominatim(endAddr)])
      if (!s || !e) throw new Error('address lookup failed')
      const engine = (this.getAttribute('engine') || ENGINE).toLowerCase()
      const route = engine === 'osrm' ? await fetchOSRM(s, e) : await fetchValhalla(s, e)
      return {
        coordinates: route.coordinates,
        maneuvers: route.maneuvers,
        start: { lat: s.lat, lon: s.lon, displayName: s.displayName },
        end: { lat: e.lat, lon: e.lon, displayName: e.displayName }
      }
    }
    deliver (result, target) {
      const forId = this.getAttribute('for') || FOR_ID
      if (forId) {
        const el = document.getElementById(forId)
        if (el && typeof el.setRoute === 'function') {
          el.setRoute(result)
          return
        }
        if (el && typeof el.setView === 'function' && result.end) {
          el.setView({ lat: result.end.lat, lon: result.end.lon })
        }
      }
      if (target) {
        // For iframe targets the host page is responsible for relaying the
        // route into the embedded map; we just dispatch the event.
      }
    }
  }
  customElements.define('route-search', RouteSearch)
}
</script>`
}

function escapeAttr (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
