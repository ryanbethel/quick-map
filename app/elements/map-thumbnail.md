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
