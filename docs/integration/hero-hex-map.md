# Hero hexagon map

The landing hero's map is Indonesia drawn as extruded hexagons (`src/features/hex-map/`). It is
**illustrative and simulated**: the land shape is Natural Earth, the per-cell values are seeded noise.
It has no frame: it floats over the hero background and casts a soft shadow on an invisible ground.

## Data and geographic accuracy

`npm run build:hex` runs `scripts/geo/build-hex-indonesia.mjs` twice (`@turf/turf`, dev dependency only):

| File                                     | Hexagon (centre to vertex) | Used for                                |
| ---------------------------------------- | -------------------------- | --------------------------------------- |
| `public/data/hex-indonesia.json`         | 0.4° (about 44 km)         | desktop and tablet                      |
| `public/data/hex-indonesia-compact.json` | 0.7° (about 78 km)         | phones (< 640 px), chosen once at mount |

Land shape: `src/features/map-3d/data/indonesia-coastline.json` (Natural Earth 1:10m Admin 0, v5.1.2,
public domain, simplified at 0.02°). Nothing is downloaded.

How the silhouette stays honest (a discrete grid is still an approximation):

1. **Coverage, not centre-in-polygon.** Each hexagon is probed at 19 points; it is kept when at least
   45 % fall on land, so thin islands survive and cells that only touch water are not added.
2. **Island identity.** Every kept cell belongs to the island holding most of its probes.
3. **No land bridges.** Two touching cells of different islands would read as one land mass, so the
   weaker one is dropped (never an island's last cell). Straits (Sunda, Bali, Makassar, Nusa Tenggara,
   Maluku…) stay open even where the grid is coarser than the water. The script refuses to write a
   grid with any cross-island contact.
4. **Small islands.** An island of at least a fifth of a hexagon's area that no cell reached gets exactly
   one cell; if that cell would touch another island it moves to the nearest free cell within three
   cells, or is dropped. Smaller islands are omitted (they would only be clutter).

`value` is **simulated** (seeded value noise, spread evenly over 0–1 by rank), identical on every
build and every theme. `null` means "no data" (drawn as a dashed outline). The file says
`kind: DEMO_SIMULATION`; the runtime validator refuses anything else.

## Rendering

- `HexScene` draws all hexagons as **one `InstancedMesh`** of a bevelled prism. The entrance
  (`hexEntrance.ts`), the hover lift and the theme wave (`hexThemeWave.ts`) are evaluated for every
  instance in one `useFrame` and written to `instanceMatrix`/`instanceColor`. Rendering is on demand and
  stops once everything is at rest.
- Lighting: ambient + hemisphere fill and one shadow-casting key light. Tiles hover above a
  `ShadowMaterial` ground, so each block throws a soft (variance shadow map) shadow; taller tiles also
  shade their neighbours.
- The camera is plain numbers in `src/lib/heroMapCamera.ts`. Pins, connector lines and the latitude
  labels in the page use the same projection and the dataset's origin, so they follow the grid.
- `HeroDioramaSlot`: hexagon map → (on WebGL or data failure, and not on phones) the relief
  `HeroDiorama` → the static Figma illustration. Only the fallbacks are clipped to the rounded zone.

## Themes

Both themes keep the value ordering (darker = higher). Normal: ivory → peach → orange → deep orange,
warm light, neutral warm shadow. Kaca: cobalt-tinted ice → peach → orange → deeper orange, cool fill
light, cobalt shadow. Switching plays a dedicated wave (not the entrance): tiles blend to the new
palette east to west (the direction of the page's liquid reveal), each rising and leaning slightly with a
soft highlight. A switch retargets from the colours on screen, so rapid switching never jumps; off
screen or before the entrance it lands without animating; with reduced motion it is a 300 ms cross-fade.

## Pins and cards

`src/features/landing/heroMapPins.ts` is the only place that maps pin → card (Wilayah A/B/C). Sequence
(`useHeroMapSequence`): hexagons settle → pins drop → lines draw → cards fade in.
