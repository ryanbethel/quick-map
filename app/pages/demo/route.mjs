// app/pages/demo/route.mjs — embed-style page that demonstrates a route
// polyline drawn over a <usgs-map>, fitted to the route's bbox.

export default function DemoRoute ({ html, state }) {
  const store = state?.store || {}
  const start = store.start || {}
  const end = store.end || {}
  return html`
<style scope=global>
  html, body { margin: 0; height: 100%; background: #e8e8e8; }
</style>

<usgs-map base-url="/demo/route">
  ${start.lat ? `<map-pin lat="${start.lat}" lon="${start.lon}" name="${attr(start.name)}"></map-pin>` : ''}
  ${end.lat ? `<map-pin lat="${end.lat}" lon="${end.lon}" name="${attr(end.name)}"></map-pin>` : ''}
</usgs-map>
`
}

function attr (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
