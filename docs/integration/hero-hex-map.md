# Hero hexagon map

The landing hero's map is Indonesia drawn as extruded hexagons (`src/features/hex-map/`). It is
**illustrative and simulated**: the land shape is Natural Earth, the per-cell values are seeded noise.

## Data

`npm run build:hex` runs `scripts/geo/build-hex-indonesia.mjs`, which fills the simplified Natural
Earth coastline (`src/features/map-3d/data/indonesia-coastline.json`) with a pointy-top hexagon grid
(`@turf/turf`, dev dependency only) and writes `public/data/hex-indonesia.json`.

- Cells: centre (`x`/`z` in degrees from the origin, `lon`/`lat`), `value` (0–1) and `hasData`.
- `value` is **simulated** (seeded value noise, spread evenly over 0–1 by rank). `hasData: false` cells
  have `value: null` and are drawn as transparent hexagons with a dashed outline.
- Every island keeps at least one cell.
- The file says `kind: DEMO_SIMULATION`; the runtime validator refuses anything else.

## Rendering

- `HexScene` draws all hexagons as **one `InstancedMesh`**. The entrance (`hexEntrance.ts`) and the hover
  lift are evaluated for every instance in a single `useFrame`; no tween per hexagon. Rendering is on
  demand and stops once everything is at rest.
- The camera is plain numbers in `src/lib/heroMapCamera.ts`. The pins, connector lines and latitude
  labels in the page use the same projection, so they sit where the 3D scene says without importing
  three.js into the main bundle.
- `HeroDioramaSlot`: hexagon map → (on WebGL or data failure, and not on phones) the relief
  `HeroDiorama` → the static Figma illustration.

## Pins and cards

`src/features/landing/heroMapPins.ts` is the only place that maps pin → card (Wilayah A/B/C). The
pins reuse the orientation nodes of the previous map; the cards describe fictional regions, so the
pins carry no data claim. Sequence (`useHeroMapSequence`): hexagons settle → pins drop → lines draw →
cards fade in; with reduced motion everything only fades.
