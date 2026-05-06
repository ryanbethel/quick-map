# `<map-thumbnail>`

Static, fixed-size preview of a USGS topo map. Pure composition over `<usgs-map>` — locks `chrome="minimal"` and `no-script` so it ships zero JS, and forces a pixel `width`/`height` so the host layout doesn't have to think about height inheritance.

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

Children (e.g. `<map-pin>`) are forwarded into the inner `<usgs-map>`'s slot.

## Theming

| variable                 | default     |
| ------------------------ | ----------- |
| `--map-thumbnail-border` | `#cccccc`   |
| `--map-thumbnail-radius` | `6px`       |

The inner `<usgs-map>`'s own variables (`--usgs-map-bg`, etc.) work too.

## Server requirements

Same as `<usgs-map>` for tile fetching (USGS basemap tiles are public). No additional API endpoints needed.
