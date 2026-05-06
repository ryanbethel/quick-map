# `<map-icon>`

A decorative SVG icon with stylized topographic contour lines and an optional map pin. No tiles, no network, no client JS. Use it as a logo, list-item glyph, or empty-state placeholder when you want to communicate "this is a map" without rendering a real one.

## Usage

```html
<map-icon></map-icon>
<map-icon size="40"></map-icon>
<map-icon size="32" pin="false"></map-icon>
```

## Attributes

| attr   | type     | default | notes                                                |
| ------ | -------- | ------- | ---------------------------------------------------- |
| `size` | number   | `24`    | Icon size in CSS pixels (square).                    |
| `pin`  | boolean  | `true`  | Render the pin overlay. Set to `"false"` for a clean topo glyph. |

## Theming

| variable                | default                |
| ----------------------- | ---------------------- |
| `--map-icon-color`      | `#2b6cb0` (contour)    |
| `--map-icon-bg`         | `#e8f0e1`              |
| `--map-icon-border`     | `currentColor`         |
| `--map-icon-radius`     | `4px`                  |
| `--map-icon-pin-color`  | `#d62828`              |

## Server requirements

None. Pure SVG.
