// <address-search>
//
// Headless address-to-coords input. Three execution modes:
//
//   no-script              → pure HTML form; no client JS shipped.
//   (default, progressive) → form + inline script that hijacks submit and
//                            fetch()es `action` (defaults to /api/geocode),
//                            dispatches `geocode:result`, and optionally
//                            drives a <usgs-map> via `for=` or an iframe via
//                            `target=`.
//   mode="direct"          → JS calls Nominatim directly; no server needed.
//
// See address-search.md for the full attribute / event reference.

export default function addressSearch({ html, state }) {
  const attrs = state?.attrs || {}
  const action = attrs.action || '/api/geocode'
  const method = (attrs.method || 'POST').toUpperCase()
  const target = attrs.target || ''
  const forId = attrs.for || ''
  const inputName = attrs.name || 'address'
  const placeholder = attrs.placeholder || 'Search address'
  const mode = attrs.mode || ''
  const noScript = attrs['no-script'] != null
  const zoom = parseInt(attrs.zoom, 10) || 14

  const form = /*html*/`
<form class="address-search-form"${target ? ` target="${escapeAttr(target)}"` : ''}
      action="${escapeAttr(action)}" method="${method}">
  <input class="address-search-input" name="${escapeAttr(inputName)}" type="text"
         placeholder="${escapeAttr(placeholder)}" autocomplete="off">
  <button class="address-search-submit" type="submit" aria-label="Search">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  </button>
</form>`

  const script = noScript ? '' : renderScript({ mode, action, forId, target, zoom, inputName })

  return html`
<style scope="global">
  address-search {
    display: block;
    width: 100%;
  }
  address-search .address-search-form {
    position: relative;
    margin: 0;
    width: 100%;
  }
  address-search .address-search-input {
    width: 100%;
    height: var(--address-search-height, 40px);
    padding: 0 40px 0 12px;
    box-sizing: border-box;
    background-color: var(--address-search-bg, #ffffff);
    color: var(--address-search-fg, #111111);
    border: 1px solid var(--address-search-border, #cccccc);
    border-radius: var(--address-search-radius, 9999px);
    font: inherit;
    box-shadow: var(--address-search-shadow, 0 1px 3px rgba(0, 0, 0, 0.2));
  }
  address-search .address-search-input::placeholder {
    color: var(--address-search-placeholder, #888888);
  }
  address-search .address-search-submit {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    color: var(--address-search-icon, #444444);
    border: 0;
    cursor: pointer;
  }
  address-search .address-search-submit:hover {
    color: var(--address-search-icon-hover, #111111);
  }
  address-search .address-search-submit svg {
    width: 20px;
    height: 20px;
  }
</style>
${form}
${script}
`
}

function renderScript({ mode, action, forId, target, zoom, inputName }) {
  const direct = mode === 'direct'
  return `
<script type="module">
if (!customElements.get('address-search')) {
  const ACTION = ${JSON.stringify(action)}
  const FOR_ID = ${JSON.stringify(forId)}
  const TARGET = ${JSON.stringify(target)}
  const INPUT_NAME = ${JSON.stringify(inputName)}
  const DEFAULT_ZOOM = ${zoom}
  const DIRECT = ${direct}

  class AddressSearch extends HTMLElement {
    connectedCallback () {
      this.form = this.querySelector('form.address-search-form')
      if (!this.form) return
      this.form.addEventListener('submit', e => this.onSubmit(e))
    }
    async onSubmit (e) {
      // Always intercept when JS is on. If we let target="iframe" forms
      // submit naturally, the iframe navigates to the geocode endpoint
      // itself (which 302s to /zoom/.../lat/.../lon/... — a *different*
      // page with its own chrome). Instead, fetch JSON and update the
      // iframe's current URL in place via deliver().
      e.preventDefault()
      const target = this.getAttribute('target') || TARGET
      const fd = new FormData(this.form)
      const address = (fd.get(INPUT_NAME) || '').toString().trim()
      if (!address) return
      let result
      try {
        result = DIRECT ? await this.directGeocode(address) : await this.fetchGeocode(address)
      } catch (err) {
        this.dispatchEvent(new CustomEvent('geocode:error', { bubbles: true, detail: { error: err.message } }))
        return
      }
      if (!result) {
        this.dispatchEvent(new CustomEvent('geocode:error', { bubbles: true, detail: { error: 'no results' } }))
        return
      }
      this.dispatchEvent(new CustomEvent('geocode:result', { bubbles: true, detail: result }))
      this.deliver(result, target)
    }
    async fetchGeocode (address) {
      const res = await fetch(this.getAttribute('action') || ACTION, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ [INPUT_NAME]: address })
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (typeof data.lat !== 'number' || typeof data.lon !== 'number') return null
      return { lat: data.lat, lon: data.lon, displayName: data.displayName || address }
    }
    async directGeocode (address) {
      const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(address) +
        '&format=jsonv2&limit=1'
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error('Nominatim ' + res.status)
      const list = await res.json()
      const hit = Array.isArray(list) && list[0]
      if (!hit) return null
      const lat = parseFloat(hit.lat), lon = parseFloat(hit.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { lat, lon, displayName: hit.display_name || address }
    }
    deliver (result, target) {
      const forId = this.getAttribute('for') || FOR_ID
      const z = parseInt(this.getAttribute('zoom'), 10) || DEFAULT_ZOOM
      if (forId) {
        const el = document.getElementById(forId)
        if (el && typeof el.setView === 'function') {
          el.setView({ lat: result.lat, lon: result.lon, zoom: z })
          return
        }
      }
      if (target) {
        const iframe = document.querySelector('iframe[name="' + target + '"]')
        if (!iframe) return
        // Prefer the iframe's *current* URL so any other state
        // (cols/rows/&c) is preserved. Fall back to the static src attr
        // for cross-origin frames where contentWindow.location is
        // off-limits.
        let basePath = ''
        try { basePath = iframe.contentWindow.location.pathname }
        catch (_e) {
          try { basePath = new URL(iframe.src, window.location.href).pathname }
          catch (_) { basePath = '' }
        }
        if (!basePath) return
        const url = new URL(basePath, window.location.href)
        url.searchParams.set('lat', result.lat.toFixed(6))
        url.searchParams.set('lon', result.lon.toFixed(6))
        url.searchParams.set('zoom', String(z))
        url.searchParams.delete('fit')
        const next = url.pathname + url.search
        try { iframe.contentWindow.location.assign(next) }
        catch { iframe.src = next }
      }
      // No target wired up — host should listen for geocode:result.
    }
  }
  customElements.define('address-search', AddressSearch)
}
</script>`
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
