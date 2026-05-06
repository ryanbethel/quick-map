# `<map-scale>`

Server-rendered scale bar for a Web-Mercator tile map. Pure HTML+CSS; ships zero client JS.

The bar snaps to a "nice" 1‑2‑5 round value (1, 2, 5, 10, 20, 50, 100 km / mi …) that fits within the requested max width — no decimal floats. Inner tick marks divide the bar into quarters or fifths depending on the chosen mantissa, and a stacked dual-unit display (km on top, mi on bottom) is the default.

## Usage

```html
<!-- Default: dual km + mi, max width 80 px -->
<map-scale zoom="12" lat="43.68"></map-scale>

<!-- km only, narrower -->
<map-scale zoom="12" lat="43.68" units="km" width="60"></map-scale>

<!-- mi only -->
<map-scale zoom="12" lat="43.68" units="mi"></map-scale>
```

## Attributes

| attr    | type             | default | notes                                                                          |
| ------- | ---------------- | ------- | ------------------------------------------------------------------------------ |
| `zoom`  | number           | —       | Required. Web-Mercator zoom (0–22).                                            |
| `lat`   | number           | `0`     | Optional latitude for cosine correction (mercator distortion).                 |
| `width` | number (px)      | `80`    | **Maximum** width of the bar. The actual rendered width is whatever the chosen 1‑2‑5 round value requires. |
| `units` | `dual`/`km`/`mi` | `dual`  | Two stacked bars (`dual`) or a single bar in one unit.                         |

## Theming

| variable                    | default                          |
| --------------------------- | -------------------------------- |
| `--map-scale-bg`            | `rgba(255, 255, 255, 0.85)`      |
| `--map-scale-fg`            | `#111111`                        |
| `--map-scale-border-radius` | `3px`                            |
| `--map-scale-padding`       | `3px 6px`                        |
| `--map-scale-font`          | `11px/1 system-ui, sans-serif`   |
| `--map-scale-line`          | `1.5px`                          |
| `--map-scale-gap`           | `1px` (between km and mi rows)   |

## Server requirements

None. Pure SSR.

## Notes

- The bar uses the standard "U" cap (left+right end ticks plus a baseline stroke). Inner ticks are short marks at quarter / fifth divisions.
- It's the default for `<usgs-map>`'s built-in scale chrome — `<usgs-map>` renders `<map-scale lat zoom width="80" units="dual">` in the bottom-right corner whenever `scale` isn't `none`.
- Because the scale is computed at SSR, it only refreshes when the page (or iframe) re-renders. If you drive an `<usgs-map>` purely with in-place client updates, the value can drift; reload (or, in the iframe pattern, navigate via the URL contract) to resync.
