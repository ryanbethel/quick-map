export default function CollectionNew ({ html, state }) {
  const pins = state?.store?.pins || []
  return html`
<style scope=global>
  html, body { margin: 0; height: 100%; }
</style>
<usgs-map>
  ${pins.map((p, i) => `<map-pin lat="${p.lat}" lon="${p.lon}" name="${attr(p.name)}" note="${attr(p.note)}" index="${i}"></map-pin>`).join('')}
</usgs-map>
`
}

function attr (s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
