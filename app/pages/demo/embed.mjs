// app/pages/demo/embed.mjs — minimal demo map for the iframe section of /demo.

export default function DemoEmbed ({ html, state }) {
  const pins = state?.store?.pins || []
  return html`
<style scope=global>
  html, body { margin: 0; height: 100%; background: #e8e8e8; }
</style>

<usgs-map base-url="/demo/embed">
  ${pins.map(p => `<map-pin lat="${p.lat}" lon="${p.lon}" name="${attr(p.name)}"></map-pin>`).join('')}
</usgs-map>
`
}

function attr (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
