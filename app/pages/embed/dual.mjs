// Two iframes pointed at the same draft session: the left lets you add /
// remove / pan / zoom; the right is a chrome-less preview showing only the
// resulting cloud of points. Both share the user's session cookie, so the
// preview sees every change to draftPins.
//
// Cross-frame refresh: every time the editor iframe finishes loading (after
// click-to-add, drag-pan navigate, etc.), a small inline script in the
// parent reloads the preview iframe so it reflects the new pin set. Without
// JS, the "Refresh preview" link in the header is the manual fallback.

export default function DualPage ({ html }) {
  const editorSrc = '/c/new'
  const previewSrc = '/c/new?preview=1'

  return html`
<style scope=global>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 14px/1.4 system-ui, -apple-system, sans-serif;
    color: #111111;
    background-color: #f3f3f3;
  }
</style>
<style>
  .dual-layout {
    display: grid;
    grid-template-rows: 48px 1fr;
    height: 100dvh;
    background-color: #cccccc;
    gap: 1px;
  }
  header.bar {
    background-color: #ffffff;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
  }
  header.bar h1 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }
  header.bar .grow { flex: 1; }
  header.bar a {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 12px;
    border: 1px solid #cccccc;
    border-radius: 9999px;
    background-color: #ffffff;
    color: #111111;
    text-decoration: none;
    font-size: 12px;
  }
  header.bar a:hover { background-color: #f4f4f4; }

  .frames {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background-color: #cccccc;
    overflow: hidden;
  }
  .frame {
    background-color: #ffffff;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .frame .label {
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    background-color: #fafafa;
    border-bottom: 1px solid #eeeeee;
    color: #555555;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background-color: #e8e8e8;
  }

  @media (max-width: 720px) {
    .frames { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  }
</style>

<div class="dual-layout">
  <header class="bar">
    <h1>Dual demo &mdash; edit on the left, preview on the right</h1>
    <span class="grow"></span>
    <a href="${previewSrc}" target="preview">Refresh preview</a>
    <a href="/c/new/clear" target="map" onclick="this.closest('a').replaceWith(this.cloneNode(true))">Clear pins</a>
  </header>

  <div class="frames">
    <section class="frame">
      <div class="label">Editor &mdash; click to add a pin</div>
      <iframe name="map" src="${editorSrc}" title="Editor map"></iframe>
    </section>
    <section class="frame">
      <div class="label">Preview &mdash; cloud of points</div>
      <iframe name="preview" src="${previewSrc}" title="Preview map"></iframe>
    </section>
  </div>
</div>

<script type="module">
  // Refresh the preview frame after every editor navigation (click-to-add,
  // drag-pan, dialog submit, etc.). We navigate to a bare /c/new?preview=1
  // (with a nonce so same-URL assignments still trigger a load) so the
  // server falls back to bboxCenterAndZoom — i.e. the preview always re-fits
  // to the latest cloud of pins. The first 'load' is the iframe's own
  // initial render; skip it.
  const editor = document.querySelector('iframe[name="map"]')
  const preview = document.querySelector('iframe[name="preview"]')
  if (editor && preview) {
    let first = true
    editor.addEventListener('load', () => {
      if (first) { first = false; return }
      try {
        const w = preview.clientWidth
        const h = preview.clientHeight
        preview.contentWindow.location.assign('/c/new?preview=1&w=' + w + '&h=' + h + '&_=' + Date.now())
      } catch (_e) {}
    })
  }

  // The "Clear pins" link uses target="map", which would leave the editor on
  // /c/new/clear's redirect page; intercept and POST programmatically so the
  // editor stays on /c/new and both frames refresh together.
  const clearLink = document.querySelector('a[href="/c/new/clear"]')
  if (clearLink) {
    clearLink.addEventListener('click', e => {
      e.preventDefault()
      const f = document.createElement('form')
      f.method = 'POST'
      f.action = '/c/new/clear'
      f.target = 'map'
      document.body.appendChild(f)
      f.submit()
      f.remove()
    })
  }
</script>
`
}
