# 3D geographic engine — integration record

The geographic 3D engine (`HeroDiorama`, `Explore3DMap`, `NusaMatra3DMap`) was developed separately and delivered as a handoff package in `integrations/nusa-matra-3d-handoff/`. That folder is a temporary external package: it is not built, linted or tested by this app, and its demo app was not migrated.

Status (2026-10-20): **integrated** in the landing hero and on Peta Utama / Jelajahi, and verified in Chrome. See "Verification" and "Open items" below.

## Where things live

| Path                                                                               | Owner       | Role                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/map-3d/`                                                             | Engine team | Host copy of `NusaMatra3DMap.tsx`, `NusaMatra3DMap.module.css` and `index.ts`, as `INTEGRATION-FOR-CLAUDE.md` instructs. Edited only for the patches listed below. Excluded from Prettier so it stays diffable against the handoff. |
| `src/features/geo3d/contract.ts`                                                   | Host        | The host's own engine-facing types (`HeroDioramaProps`, `Explore3DMapProps`, `GeoCameraHandle`, `GeoRegionSelection`).                                                                                                              |
| `src/features/geo3d/engineAdapters.tsx`                                            | Host        | The only file that knows the engine's prop and handle names; maps the host contract onto them.                                                                                                                                      |
| `src/features/geo3d/engineRegistry.ts`                                             | Host        | Lazy registration. Set an entry to `null` to ship without the engine.                                                                                                                                                               |
| `src/features/geo3d/HeroDioramaSlot.tsx`, `Explore3DMapSlot.tsx`, `EngineSlot.tsx` | Host        | Slots: Figma placeholder first, engine fades in after `onReady`, placeholder returns on any failure.                                                                                                                                |
| `src/features/exploration/`                                                        | Host        | Map workspace: selection in `?wilayah=`, keyboard region list, DEMO labelling.                                                                                                                                                      |
| `src/data/fixtures/demoGeoRegions.ts`                                              | Host        | Keyboard list of the engine's DEMO island groups; a test keeps it identical to the engine dataset.                                                                                                                                  |

## Responsibilities

| Host website                                                          | 3D engine                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Routing ("Mulai jelajahi" → `/peta`)                                  | Rendering, camera, pointer interaction, WebGL lifecycle and disposal                         |
| Normal/Kaca mode, reduced motion, liquid navbar and theme transition  | Restyling from `displayMode`; respecting `reducedMotion`                                     |
| Geography data (none verified yet → `null`, DEMO only)                | Validating geography (`validateAndAdaptGeography`), refusing LIVE without a verified dataset |
| Selection state (URL), keyboard/screen-reader region list             | Reporting clicks/hovers; `focusRegion`, `resetCamera`                                        |
| Still image on phones (Figma 43:713), placeholders, error containment | `onReady` once WebGL is up, `onError` on failure                                             |

## Integration points

| Slot                            | Figma                                 | Mounted in                                                                    | Engine component                                                   |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `HeroDioramaSlot scene="hero"`  | 3D-1, 27:2 / 27:118 hero right column | `src/features/landing/sections/HeroSection.tsx`                               | `HeroDiorama` (desktop/tablet ≥768px; phones keep the Figma still) |
| `HeroDioramaSlot scene="story"` | 3D-5, 41:337                          | `src/features/landing/sections/StorySection.tsx`                              | none — the engine has no story scene; Figma illustration           |
| `Explore3DMapSlot`              | 61:1183, 29:34                        | `src/features/exploration/ExplorationMapPanel.tsx` on `/peta` and `/jelajahi` | `Explore3DMap` with `geography={null}` (DEMO illustration)         |

Hero and Explore never mount at the same time (different routes); both load lazily (`engineAdapters-*.js` ≈ 11 kB gzip plus the shared `three-*.js` chunk).

## Patches applied to the host copy (please upstream)

1. **Bug — `validateAndAdaptGeography(undefined | null)` threw a ReferenceError.** The metadata checks read `candidate` before its declaration, so `Explore3DMap` without a dataset always showed "Data Geografi Belum Tersedia". The checks now run on the supplied dataset; with no dataset, DEMO returns the illustration and LIVE throws. Covered by `src/features/map-3d/geography.test.ts`.
2. **`PCFSoftShadowMap` → `PCFShadowMap`.** Deprecated since three r186, which the host uses.
3. **Strict index access.** Guards for `normalized[0]/[n-1]`, raycast `hits[0]`, `root.children[0]`, and `as const` colour tuples, so the file compiles under the host's `noUncheckedIndexedAccess`.

4. **Hero relief rebuild (owner request, 2026-10-20).** The hero's seven illustrative polygons on a dark cylinder were replaced by the Natural Earth coastline relief described below. Explore is unchanged.

ESLint relaxes its stylistic profile only for the engine's own files (`src/features/map-3d/*.{ts,tsx}`), so they are not rewritten in the host's style; correctness rules stay on. Prettier skips the same files. The host-written `terrain/` modules follow the full host profile.

## Hero diorama relief (`src/features/map-3d/terrain/`)

The owner asked for the geographic richness of the original `peta_3d_geospasial_indonesia.html` prototype in the hero: recognizable coastlines with small islands, real relief, limestone materials and a lighter ocean, with the whole archipelago framed. The engine was not rebuilt. `NusaMatra3DMap.tsx` gained a hero branch that calls these modules:

| Module                                             | Role                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/indonesia-coastline.json` + `data/README.md` | Natural Earth 1:10m v5.1.2 coastline of Indonesia (public domain): 241 islands, 25 kB gzip. Rebuilt with `scripts/geo/build-indonesia-coastline.mjs`.                                                        |
| `coastline.ts`                                     | Runtime validation at the data boundary (closed rings, plausible coordinates, licence and source metadata present).                                                                                          |
| `heightField.ts`                                   | **Illustrative** relief: rises with distance from the shore and is shaped by ridged noise. Baked hillshade. Distance to land for the sea shelf. Not a DEM; the hero badge says so.                           |
| `surfaceTextures.ts`                               | Hypsometric chalk ramp (`#FBFAF6` → `#B8AF9A`) with contour lines and grain. Coastline alpha mask at 1536 px. Cobalt sea with a pale shelf, shore wash and a faint 5° graticule.                             |
| `heroTerrain.ts`                                   | Displaced relief mesh, alpha-tested and casting alpha-correct shadows. Extruded, bevelled limestone plinth for the cliffs. Textured sea plane. Per-dataset cache, so remounts and StrictMode reuse the data. |
| `cameraFit.ts`                                     | Frames the convex hull of the coastline for the container's aspect ratio. Re-fits on resize.                                                                                                                 |

Unchanged behaviour: the entrance animation, ±6° pointer parallax, the three orange markers (now standing on the terrain and scaled for the wider shot), reduced motion (a static frame), the lazy chunk, the phone still image, Normal/Kaca roughness, and `onReady` (now after the hero geometry is built).

Cost: the engine chunk grew from 11 to 42 kB gzip. In dev-mode Chrome, the first terrain build blocks the main thread for about 350 ms, inside the lazy-loaded engine while the Figma placeholder is showing; a remount takes about 80 ms. Node profile of the build: height field 82 ms, land texture 63 ms, sea texture 55 ms, plus geometry. The relief mesh has about 40k vertices and the plinth about 96k. One 2048² shadow map.

Known limits:

- Indonesia only: Malaysian Borneo, Timor-Leste and PNG are not drawn.
- The host's Figma callout cards still overlap northern Sumatra at 1440 px. That is the Figma layout, not a framing gap.
- Moving the terrain build into a Web Worker would remove the first-load stall; not done yet.

## Verification (2026-10-20)

- `npm run typecheck`, `npm run lint`, `npm run test` (88 tests, incl. the ported engine tests and the terrain tests), `npm run build`, `npm run test:e2e` (13 passed, 1 skipped by design): all pass.
- Headless Chrome (local Chrome, SwiftShader WebGL):
  - Hero reaches `ready` in Normal and Kaca.
  - Theme toggle while mounted works.
  - Reduced motion toggled **while mounted** keeps the scene (islands and markers stay).
  - Phones (390px) show the Figma still with no canvas.
- `/peta`:
  - The engine renders.
  - Keyboard selection from the list highlights the island, calls `focusRegion` and writes `?wilayah=ID-DEMO-SULAWESI`.
  - Three hero ↔ map route round-trips leave a single canvas, with no console errors.
- Remaining console warning: `THREE.Clock` deprecation from `@react-three/fiber` (host 3D-2/3D-3 scenes), not from the engine.

## Open items for the engine team

- **Art direction vs Figma 3D-1.** Partly addressed by the relief rebuild: chalk islands, a cobalt sea and orange markers. The hero still fills its zone edge to edge instead of floating as a plate on the page background.
- **`onReady` in Explore fires when WebGL starts, not when geometry is built.** The hero now builds its geometry first.
- **WebGL failure shows the engine's text panel.** It sits on the hidden engine layer, so the host still shows the Figma image; an engine-side image fallback would be cleaner.
- **No story camera (3D-5).** No "Mulai jelajahi" camera transition is wired yet (`triggerExploreTransition` exists but is unused).
- **OrbitControls zoom takes the mouse wheel over the Explore map.** This is acceptable for an interactive map, but worth a design decision.
- **Data Hub geography still needs auditing.** Real payloads (code system, boundary edition, ring winding and holes, density) are still to be audited before LIVE.
