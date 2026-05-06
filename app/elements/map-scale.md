# `<map-scale>`

Progressively-enhanced scale bar for a Web-Mercator tile map. SSR with a tiny client-side enhancement script (≈1.6 kB inline + a shared 5 kB module) that re-renders the bar in place when its `lat`, `zoom`, `width`, or `units` attributes change.

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
| `zoom`  | number           | —       | Required. Web-Mercator zoom (0–22). Observed — re-renders on change.           |
| `lat`   | number           | `0`     | Optional latitude for cosine correction (mercator distortion). Observed.       |
| `width` | number (px)      | `80`    | **Maximum** width of the bar. The actual rendered width is whatever the chosen 1‑2‑5 round value requires. Observed. |
| `units` | `dual`/`km`/`mi` | `dual`  | Two stacked bars (`dual`) or a single bar in one unit. Observed.               |
| `no-script` | boolean      | —       | Suppress the inline enhancement script (pure-SSR mode).                        |

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

None for SSR. The enhancement script imports a small ES module from `/_public/browser/map-scale.mjs`, which Enhance bundles automatically from `app/browser/map-scale.mjs`.

## Render modes

- **SSR-only** — works without JS. Every `lat`/`zoom`/`width`/`units` change requires a new server render.
- **SSR + CSR (default)** — the inline script registers a Custom Element class that observes the four attributes. When any of them changes, the same nice-round math runs in the browser and the bar's inner DOM is replaced in place. No network roundtrip; no flash on first paint (initial attribute callbacks before `connectedCallback` are skipped because the SSR markup is already correct).
- **Disable enhancement** — pass the boolean `no-script` attribute to suppress the inline script entirely (useful when embedding inside another component that handles scripting itself).

This is what makes `<usgs-map>`'s `render="client"` mode usable: the parent map element calls `scale.setAttribute('lat', ...)` / `setAttribute('zoom', ...)` during its `rerender()` and the bar updates immediately.

## Notes

- The bar uses the standard "U" cap (left+right end ticks plus a baseline stroke). Inner ticks are short marks at quarter / fifth divisions.
- It's the default for `<usgs-map>`'s built-in scale chrome — `<usgs-map>` renders `<map-scale lat zoom width="80" units="dual">` in the bottom-right corner whenever `scale` isn't `none`.
- All math (cosine-corrected metres-per-pixel, 1‑2‑5 nice rounding, two-row aria label) lives in `app/browser/map-scale.mjs` and is shared verbatim between SSR and the browser, so the values agree to the last pixel.
