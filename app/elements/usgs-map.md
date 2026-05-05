# `<usgs-map>`

Server-rendered USGS topo map. Drop it in a page template; pass map state via `state.store` from the matching API handler. Works with no JS; client-side enhancement adds drag, pinch, dbl-click, dialog-based pin add, and viewport-aware grid sizing.

## Page template

```js
// app/pages/c/$id.mjs
export default function CollectionPage ({ html, state }) {
  const { pins = [] } = state.store
  return html`
<usgs-map>
  ${pins.map((p, i) => `
    <map-pin lat="${p.lat}" lon="${p.lon}" name="${p.name || ''}" note="${p.note || ''}" index="${i}"></map-pin>
  `).join('')}
</usgs-map>
`
}
```

## API handler — what to put in `state.store`

```js
// app/api/c/$id.mjs
import { bboxCenterAndZoom } from '../../lib/tiles.mjs'

export async function get (req) {
  const pins = /* ...load from DB... */
  const cols = parseInt(req.query?.cols, 10) || 7
  const rows = parseInt(req.query?.rows, 10) || 7
  const fit = bboxCenterAndZoom(pins, cols, rows)
  const lat = parseFloat(req.query?.lat) || fit.centerLat
  const lon = parseFloat(req.query?.lon) || fit.centerLon
  const zoom = parseInt(req.query?.zoom, 10) || fit.zoom

  return {
    json: {
      centerLat: lat, centerLon: lon, zoom,
      gridCols: cols, gridRows: rows,
      collectionMode: 'view',           // or 'create'
      collectionId: req.params.id,      // used to build URLs in view mode
      collectionTitle: 'Whatever',
      pins,
      fit                               // optional, drives the "Fit pins" button
    }
  }
}
```

## Store keys

| key                           | type          | notes                                               |
| ----------------------------- | ------------- | --------------------------------------------------- |
| `centerLat`, `centerLon`      | number        | required                                            |
| `zoom`                        | int 0–16      | required                                            |
| `gridCols`, `gridRows`        | int 5–13      | default 7×7; client may navigate to a fitted size   |
| `collectionMode`              | `view`/`create` | default `view`                                    |
| `collectionId`                | string        | used by `view` mode for URLs                        |
| `collectionTitle`             | string        | viewer panel header                                 |
| `draftPinCount`               | int           | create mode only, shown in header                   |
| `fit`                         | `{centerLat, centerLon, zoom}` | optional; renders "Fit pins" link  |
| `flash`                       | string        | optional banner                                     |

`<map-pin>` reads its own `lat`/`lon`/`name`/`note`/`index` attrs, and the same `state.store` for centering math.

## URL contract (no-JS baseline)

All pan/zoom controls submit a GET form with hidden inputs `lat`, `lon`, `zoom`, `cols`, `rows`. Your handler must accept them.

- `view` mode posts to `/c/{collectionId}`.
- `create` mode posts to `/c/new`.

The client-side enhancement uses the same query string when navigating after drag/pinch/dbl-click.

## Endpoints `<usgs-map>` and `<map-pin>` POST to (create mode)

| method/url           | from                   | body                       |
| -------------------- | ---------------------- | -------------------------- |
| `POST /c/new/add`    | dialog or panel form   | `lat`, `lon`, `zoom`, `name`, `note` |
| `POST /c/new/remove` | pin popover            | `index`                    |
| `POST /c/new/clear`  | panel                  | (none)                     |
| `POST /c`            | save panel             | `title`                    |

`/c/new/add` redirects using `req.session.lastCenter` so click-to-add doesn't yank the viewport to the new pin.

## Embedding in an iframe (form-targets-frame pattern)

Because every gesture lands at a `/c/$id?lat=…&lon=…&zoom=…&cols=…&rows=…` URL and the map renders as a standalone page, you can host it in an `<iframe>` and drive it from the parent page with `target="map"` — no JS, no `postMessage`, no parent reload.

```html
<a href="/c/abc?lat=43.68&lon=-70.25&zoom=11" target="map">Portland</a>

<form action="/c/abc" method="GET" target="map">
  <input name="lat"><input name="lon"><input name="zoom" value="13">
  <button>Go</button>
</form>

<iframe name="map" src="/c/abc"></iframe>
```

Working example: `app/pages/embed/$id.mjs` (route: `/embed/:id`).

## Client behavior summary

- 1 pointer → drag-to-pan; release snaps to nearest tile boundary then navigates.
- 2 pointers → pinch; release zooms ±1 if scale crosses 1.5× / 0.67×, anchored at midpoint.
- Mouse `dblclick` (view mode only) → zoom +1 centered on click.
- Click on map (create mode only) → opens `<dialog>` with lat/lon pre-filled.
- One `<map-pin>` `<details>` open at a time; Esc and outside-click close.
- `connectedCallback` and resize re-navigate to a viewport-fit `cols`/`rows` (paused while dragging, pinching, dialog open, or input focused).
