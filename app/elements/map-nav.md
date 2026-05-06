# `<map-nav>`

Pan / zoom / locate control panel that drives a `<usgs-map>` — slotted, by id, or via iframe.

## Modes

| mode      | enable                | ships                                    |
| --------- | --------------------- | ---------------------------------------- |
| no-script | `no-script` attribute | 6 forms with hidden inputs only          |
| default   | (no `mode` attribute) | forms + ~1 KB inline script              |

There is no `mode="direct"` for `<map-nav>` — it doesn't talk to any external API.

## State sharing

Pick the pattern that matches your layout:

### Pattern A — Slotted

```html
<usgs-map lat="43.68" lon="-70.25" zoom="11">
  <map-nav slot="controls"></map-nav>
</usgs-map>
```

The script walks up the DOM (`closest('usgs-map')`) and calls imperative methods on the parent map. No wiring required.

### Pattern B — Sibling, same document

```html
<map-nav for="my-map"></map-nav>
<usgs-map id="my-map" lat="43.68" lon="-70.25" zoom="11"></usgs-map>
```

### Pattern C — Cross-frame iframe

```html
<iframe name="map" src="/c/abc"></iframe>
<map-nav target="map" base-url="/c/abc" lat="43.68" lon="-70.25" zoom="11" cols="7" rows="7"></map-nav>
```

The forms have `target="map"`. With JS off, submissions navigate the iframe naturally. With JS on, the script intercepts each click, increments its **own** lat/lon/zoom state, and imperatively drives `iframe.contentWindow.location.assign(...)` (or falls back to `iframe.src`). This is what makes repeated clicks work — the next URL always reflects the current state, not the SSR'd hidden inputs.

The consumer must pass initial `lat`/`lon`/`zoom` (and optionally `cols`/`rows`) so the panel knows where to start. After that, the panel tracks state internally; if the iframe is also being driven by something else (e.g. an `<address-search target="map">`), the two state sources can drift. Reload the host page or update the panel's attributes to resync.

### Same-doc state syncing (Patterns A & B)

For Pattern A and B the panel listens for `map:move` events from the target map and resyncs its lat/lon/zoom each time. So clicking the built-in `<usgs-map>` chrome, dragging, or any other interaction keeps the `<map-nav>` panel in step.

## Attributes

| attr        | type     | notes |
| ----------- | -------- | ----- |
| `lat`       | number   | Current map latitude. Required for Pattern C / no-JS. |
| `lon`       | number   | Current map longitude. Required for Pattern C / no-JS. |
| `zoom`      | int      | Current zoom (0–16). Required for Pattern C / no-JS. |
| `cols`      | int      | Tile-grid cols (default 7). Used to compute pan deltas. |
| `rows`      | int      | Tile-grid rows (default 7). |
| `base-url`  | string   | Form `action`. Pattern C requires this. |
| `target`    | string   | Iframe name (Pattern C). |
| `for`       | string   | Id of a `<usgs-map>` to drive (Pattern B). |
| `locate`    | `false`  | Hide the geolocation button. |
| `no-script` | (boolean)| Suppress the inline `<script>`. |

## Imperative API the parent map must expose

`<usgs-map>` provides these methods (no-op fallback if missing):

- `zoomIn()` / `zoomOut()` — change zoom by ±1, clamped to 0–16.
- `panBy(dx, dy)` — pan by `dx`/`dy` pixels (one tile = 256 px).
- `setView({ lat, lon, zoom })` — jump to a specific view.

## Events

| event           | detail                  |
| --------------- | ----------------------- |
| `mapnav:action` | `{ action }` — one of `zoom-in`, `zoom-out`, `pan-n/s/e/w`, `locate`. |
| `mapnav:locate` | `{ lat, lon }`           |
| `mapnav:error`  | `{ error }`              |

## Theming

| variable                          | default                         |
| --------------------------------- | ------------------------------- |
| `--map-nav-cell`                  | `36px`                          |
| `--map-nav-gap`                   | `4px`                           |
| `--map-nav-padding`               | `6px`                           |
| `--map-nav-bg`                    | `rgba(255,255,255,0.95)`        |
| `--map-nav-fg`                    | `#111111`                       |
| `--map-nav-border`                | `#cccccc`                       |
| `--map-nav-radius`                | `8px`                           |
| `--map-nav-shadow`                | `0 1px 4px rgba(0,0,0,0.2)`     |
| `--map-nav-button-bg/fg/border`   | `#ffffff` / `#111111` / `#cccccc` |
| `--map-nav-button-radius`         | `6px`                           |
| `--map-nav-button-hover-bg`       | `#f2f2f2`                       |
