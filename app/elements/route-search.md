# `<route-search>`

Headless start/end address pair that returns a routed path. Mirrors `<address-search>`'s mode model: HTML-first form, optional fetch enhancement, optional direct-to-public-API mode.

## Modes

| mode      | enable                | ships                              | server needed?              |
| --------- | --------------------- | ---------------------------------- | --------------------------- |
| no-script | `no-script` attribute | HTML form only                     | yes (`/directions` or yours) |
| default   | (no `mode` attribute) | HTML form + ~3 KB inline script    | optional (`/api/route`)      |
| direct    | `mode="direct"`       | HTML form + script that calls Nominatim + Valhalla/OSRM directly | no |

## Usage

```html
<!-- Default progressive: works without JS, enhanced with JS. -->
<route-search action="/api/route"></route-search>

<!-- Pure clientside, no server -->
<route-search mode="direct" engine="valhalla" for="my-map"></route-search>

<!-- No-JS only, ships zero JS -->
<route-search no-script no-script-action="/directions"></route-search>
```

## Attributes

| attr               | default          | notes |
| ------------------ | ---------------- | ----- |
| `mode`             | (none)           | `"direct"` for clientside Valhalla/OSRM. |
| `engine`           | `valhalla`       | `valhalla` or `osrm` (used in direct mode). |
| `action`           | `/api/route`     | URL the JS path posts to. |
| `no-script-action` | `/directions`    | URL the no-JS form posts to (defaults to the existing route handler that persists to DDB). |
| `method`           | `POST`           | Form method. |
| `no-script`        | (boolean)        | Suppresses the inline `<script>`. |
| `for`              | (none)           | Id of a `<usgs-map>` to drive after a successful route. The map's `setRoute(result)` is called if defined; otherwise `setView({ lat, lon })` to the destination. |
| `target`           | (none)           | Iframe name for cross-frame form submission. |
| `start`, `end`     | (none)           | Pre-fill values. (The element also reads `state.store.directions.{startAddress,endAddress}` so server-rendered values flow through automatically.) |

## Events

| event           | detail                                                              |
| --------------- | ------------------------------------------------------------------- |
| `route:result`  | `{ coordinates: [[lat,lon],...], maneuvers: string[], start, end }` |
| `route:error`   | `{ error }`                                                         |

`coordinates` is a decoded polyline; `start`/`end` are `{ lat, lon, displayName }`.

## Server contract (default mode)

`POST {action}` with `application/x-www-form-urlencoded` body `start=...&end=...`. Sends `Accept: application/json`.

Expected JSON:

```json
{
  "coordinates": [[43.68, -70.25], ...],
  "maneuvers": ["Head south on Maine Street.", "..."],
  "start": { "lat": 43.68, "lon": -70.25, "displayName": "..." },
  "end":   { "lat": 44.31, "lon": -69.78, "displayName": "..." }
}
```

A reference implementation is in [app/api/route.mjs](../api/route.mjs).

## Theming

| variable                              | default                       |
| ------------------------------------- | ----------------------------- |
| `--route-search-bg`                   | `rgba(255,255,255,0.95)`      |
| `--route-search-fg`                   | `#111111`                     |
| `--route-search-border`               | `#cccccc`                     |
| `--route-search-radius`               | `8px`                         |
| `--route-search-shadow`               | `0 1px 4px rgba(0,0,0,0.2)`   |
| `--route-search-padding`              | `8px`                         |
| `--route-search-label-fg`             | `#444444`                     |
| `--route-search-input-bg/fg/border`   | `#ffffff` / `#111111` / `#cccccc` |
| `--route-search-input-radius`         | `4px`                         |
| `--route-search-button-bg/fg/border`  | `#ffffff` / `#111111` / `#cccccc` |
| `--route-search-primary-bg/fg`        | `#0066ff` / `#ffffff`         |
