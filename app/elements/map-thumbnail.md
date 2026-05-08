# `<map-thumbnail>`

Static, fixed-size preview of a USGS topo map. Pure composition over `<usgs-map>` — locks `chrome="minimal"` and `no-script` so it ships zero JS, and renders an inline-styled `.map-thumbnail-box` wrapper at the requested `width`/`height` so the host layout doesn't have to think about height inheritance.

> The `<usgs-map>` inside has no `width`/`height` attrs (those are no-ops upstream — see [`<usgs-map>`'s authoring constraint](./usgs-map.md#authoring-constraint)). Per-instance sizing happens via the `style="width: …; height: …;"` attribute on `.map-thumbnail-box`, so two thumbnails of different sizes on the same page no longer overwrite each other in the global stylesheet.

## Usage

```html
<map-thumbnail lat="43.68" lon="-70.25" zoom="11"></map-thumbnail>

<map-thumbnail lat="43.68" lon="-70.25" zoom="12" width="240" height="160">
  <map-pin lat="43.68" lon="-70.25"></map-pin>
  <map-pin lat="43.65" lon="-70.30"></map-pin>
</map-thumbnail>
```

## Attributes

| attr     | default | notes                                           |
| -------- | ------- | ----------------------------------------------- |
| `lat`    | —       | Center latitude (passed through to `<usgs-map>`). |
| `lon`    | —       | Center longitude.                                |
| `zoom`   | —       | Zoom level.                                      |
| `cols`   | `3`     | Tile-grid cols (small for thumbnails).           |
| `rows`   | `3`     | Tile-grid rows.                                  |
| `width`  | `160px` | Pixel size, or any CSS length.                   |
| `height` | `100px` | Pixel size, or any CSS length.                   |
| `pin`    | (off)   | When set (any non-`false`/`0` value), overlays a center pin marker. Decorative only — `pointer-events: none` so it never blocks clicks on the host element. Use slotted `<map-pin>` children for projected, multi-point pins. |

Children (e.g. `<map-pin>`) are forwarded into the inner `<usgs-map>`'s slot.

## Theming

| variable                       | default                                |
| ------------------------------ | -------------------------------------- |
| `--map-thumbnail-border`       | `#cccccc`                              |
| `--map-thumbnail-radius`       | `6px`                                  |
| `--map-thumbnail-pin-color`    | `#d62828`                              |
| `--map-thumbnail-pin-size`     | `24px`                                 |
| `--map-thumbnail-pin-shadow`   | `drop-shadow(0 1px 2px rgba(0,0,0,.5))` |

The inner `<usgs-map>`'s own variables (`--usgs-map-bg`, etc.) work too.

## Server requirements

Same as `<usgs-map>` for tile fetching (USGS basemap tiles are public). No additional API endpoints needed.

## Attribution

Thumbnails inherit `chrome="minimal"`, which suppresses the on-map credit that `<usgs-map>` shows by default — a single thumbnail isn't tall enough to carry "USGS National Map · © OpenStreetMap · Geocoding by LocationIQ" without the credit dominating it. **The host page is responsible for displaying the credit somewhere visible** when it renders `<map-thumbnail>` (or any non-trivial number of thumbnails). The shortest acceptable form is the same string `<usgs-map>` would render:

```html
<p>
  <a href="https://nationalmap.gov/">USGS National Map</a>
  &middot;
  <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a>
  &middot;
  <a href="https://locationiq.com">Geocoding by LocationIQ</a>
</p>
```

Drop the LocationIQ link only if your project doesn't actually use the `<address-search>` / LocationIQ geocoding integration, or if you're on a paid LocationIQ Developer plan that waives the link requirement.

Pages that mix one full `<usgs-map>` with several `<map-thumbnail>` previews get this for free via the full map's built-in credit and don't need to add their own.
