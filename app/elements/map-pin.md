# `<map-pin>`

A pin overlay for `<usgs-map>`. Reads its lat/lon from attrs, then projects itself onto the map's tile grid using the geometry the map publishes via `state.store`.

## Usage

```html
<usgs-map>
  <map-pin lat="43.68" lon="-70.25" name="Portland" note="Vacation"></map-pin>
  <map-pin lat="44.31" lon="-69.78"></map-pin>
</usgs-map>
```

## Attributes

| attr     | type    | notes                                                                |
| -------- | ------- | -------------------------------------------------------------------- |
| `lat`    | number  | Required. Pin latitude.                                              |
| `lon`    | number  | Required. Pin longitude.                                             |
| `name`   | string  | Optional. Title shown in the popover.                                |
| `note`   | string  | Optional. Body text shown in the popover.                            |
| `index`  | int     | Optional. Used by the collection editor for the "remove" form.       |

If the pin's projected position falls outside the map's tile grid (with a small margin), the element renders nothing — so off-screen pins are cheap.

## Theming

| variable                       | default                                |
| ------------------------------ | -------------------------------------- |
| `--map-pin-color`              | `#1a73e8` (closed)                     |
| `--map-pin-color-open`         | `#d62828` (popover open)               |
| `--map-pin-size`               | `28px`                                 |
| `--map-pin-shadow`             | `drop-shadow(0 1px 2px rgba(0,0,0,0.5))` |
| `--map-pin-info-bg`            | `rgba(255,255,255,0.98)`               |
| `--map-pin-info-fg`            | `#111111`                              |
| `--map-pin-info-border`        | `#cccccc`                              |
| `--map-pin-info-radius`        | `6px`                                  |
| `--map-pin-info-shadow`        | `0 2px 8px rgba(0,0,0,0.25)`           |
| `--map-pin-info-padding`       | `8px 10px`                             |
| `--map-pin-info-font`          | `13px/1.35 system-ui, sans-serif`      |
| `--map-pin-button-bg/fg/border`| `#ffffff` / `#111111` / `#cccccc`      |
| `--map-pin-danger-fg`          | `#b3261e`                              |

## Behavior

- Tap/click the pin → popover opens (`<details>`).
- The parent `<usgs-map>` (when JS is on) keeps only one popover open at a time and closes them on Esc / outside-click.
- In a saved collection (`state.store.collectionMode === 'view'`), the popover renders a "Center here" link that navigates the URL.
- In the editor (`collectionMode === 'create'`), the popover renders a "Remove" form posting to `/c/new/remove`.

## Server requirements

`<map-pin>` itself requires nothing. The parent `<usgs-map>`'s API handler must set `state.store.centerLat`, `centerLon`, `zoom`, and (optionally) `gridCols`/`gridRows` so the pin can project its position. See [usgs-map.md](./usgs-map.md).
