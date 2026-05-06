# `<address-search>`

Headless address-to-coords input. Submits a `<form>` for the no-JS path and exposes a JS-enhanced fetch path that dispatches a `geocode:result` event and (optionally) drives a `<usgs-map>` or iframe.

## Modes

| mode             | how to enable           | what gets shipped               | needs server?              |
| ---------------- | ----------------------- | ------------------------------- | -------------------------- |
| no-script        | `no-script` attribute   | HTML form only, zero JS         | yes (the form posts to `action`) |
| default          | (no `mode` attribute)   | HTML form + ~1.5 KB inline script | optional — works without JS, falls back to `action` |
| direct           | `mode="direct"`         | HTML form + script that calls Nominatim from the browser | no |

## Usage

### Default progressive (recommended)

```html
<address-search action="/api/geocode" for="my-map"></address-search>
<usgs-map id="my-map" lat="43.68" lon="-70.25" zoom="10"></usgs-map>
```

JS off → form POSTs to `/api/geocode` and your server redirects.
JS on  → fetches `/api/geocode`, dispatches `geocode:result`, and calls `mapEl.setView({ lat, lon, zoom })` automatically.

### No-script

```html
<address-search no-script action="/api/geocode"></address-search>
```

Pure HTML form. No script element rendered. Your server must handle the POST and navigate the user somewhere useful.

### Pure clientside (no server of your own)

```html
<address-search mode="direct" for="my-map"></address-search>
```

Calls `https://nominatim.openstreetmap.org/search` directly. No `action` endpoint needed.

### Driving an iframe

```html
<iframe name="map" src="/c/abc"></iframe>
<address-search target="map" action="/api/geocode"></address-search>
```

No-JS: form `target="map"` makes the response land in the iframe.
JS: after fetching, the script sets `iframe.contentWindow.location` so the iframe re-renders without a flash on the parent.

## Attributes

| attr          | default          | notes |
| ------------- | ---------------- | ----- |
| `action`      | `/api/geocode`   | URL the form posts to. |
| `method`      | `POST`           | Form method. |
| `mode`        | (none)           | Set to `"direct"` for clientside Nominatim. |
| `no-script`   | (boolean)        | Suppresses the inline `<script>`. |
| `name`        | `address`        | `name=` of the input field. |
| `placeholder` | `Search address` | Input placeholder. |
| `for`         | (none)           | Id of a `<usgs-map>` to drive after a successful lookup. |
| `target`      | (none)           | Iframe name (Pattern C). |
| `zoom`        | `14`             | Zoom level used when driving a map / iframe. |

## Events

| event             | detail                              | when |
| ----------------- | ----------------------------------- | ---- |
| `geocode:result`  | `{ lat, lon, displayName }`         | After a successful lookup. Bubbles. |
| `geocode:error`   | `{ error }`                         | On HTTP/network/no-results. Bubbles. |

## Server contract (default mode)

`POST {action}` with `application/x-www-form-urlencoded` body `address=...`. The element sends `Accept: application/json` so handlers can branch on it.

Expected JSON response:

```json
{ "lat": 43.68, "lon": -70.25, "displayName": "Portland, ME" }
```

A reference implementation is in [app/api/geocode.mjs](../api/geocode.mjs).

## Theming

| variable                            | default                       |
| ----------------------------------- | ----------------------------- |
| `--address-search-bg`               | `#ffffff`                     |
| `--address-search-fg`               | `#111111`                     |
| `--address-search-border`           | `#cccccc`                     |
| `--address-search-radius`           | `9999px`                      |
| `--address-search-height`           | `40px`                        |
| `--address-search-shadow`           | `0 1px 3px rgba(0,0,0,0.2)`   |
| `--address-search-placeholder`      | `#888888`                     |
| `--address-search-icon`             | `#444444`                     |
| `--address-search-icon-hover`       | `#111111`                     |
