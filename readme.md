# quick-map

USGS topo map UI: Enhance elements + tiny browser modules. Full runnable app lives in this repo; as a dependency you mostly pull **elements** and **browser** helpers.

## Install from GitHub

```bash
npm i github:ryanbethel/quick-map#main
```

Pin a tag or commit when you care about stability: `github:ryanbethel/quick-map#v0.0.1`.

## Imports (`package.json` → `exports`)

Paths are under the package name; include the `.mjs` (or `.md`) suffix.

| Prefix | Resolves to |
|--------|-------------|
| `quick-map/browser/*` | `app/browser/*` |
| `quick-map/elements/*` | `app/elements/*` |

Examples:

```js
import { buildTileGrid, pixelToLatLon } from 'quick-map/browser/tiles.mjs'
import usgsMap from 'quick-map/elements/usgs-map.mjs'
```

## Component docs

Each element has a co-located `.md` (design / API notes). Browse on GitHub: [app/elements](https://github.com/ryanbethel/quick-map/tree/main/app/elements) — same filenames as the `.mjs` imports, extension `.md`.

## Reminders

- Server templates assume **Enhance** (`html` tagged templates). Client pieces are plain **Custom Elements** + DOM.
- Elements that hydrate often pull shared math from `quick-map/browser/tiles.mjs` (or `map-scale.mjs`); keep both prefixes if you copy paths.
- Wider stack notes: [AGENTS.md](./AGENTS.md).

## Roadmap (local scratch)

- [x] Double-click zoom / center, long-press marker, drag pan (client PE)
- [x] Client-only tile updates, tile proxy, SW / offline, multi-zoom prefetch, periodic location
- [x] Run map clientside for PE
- [ ] Proxy Maps
- [ ] Service worker for offline maps 
- [ ] Download multiple zoom levels for offline map
- [ ] update location periodically
