# Claude Code — Nusa Matra 3D integration handoff

**Do not copy the entire demo app or its `package.json` into the host repo.** Copy `src/NusaMatra3DMap.tsx`, `src/NusaMatra3DMap.module.css`, `src/index.ts`, and `src/css-modules.d.ts` into a host-local `src/features/map-3d/` directory, adjusting tsconfig aliases and exports as needed. Install compatible Three.js and `@types/three` versions if missing; reuse existing React rather than installing duplicates.

Import `HeroDiorama` and `Explore3DMap` through the feature barrel `index.ts`.

## Host integration

- **Landing Figma 27:2 / 27:118:** Hero right column; parent height 360–520px; viewport width constrained by layout.
- **Jelajahi / Peta Utama 29:34 / 61:1183:** Optional Explore 3D mode with parent height determined by page layout. Avoid replacing the primary Figma 2D/map view without approval.
- Pass `displayMode='normal'|'glass'`, `dataMode='DEMO'|'LIVE'`, `reducedMotion`, `selectedRegionId`, and `onSelectRegion` from the host.
- Each region is selected via canonical `regionId` and `boundaryEditionId`. Never join illustrative silhouettes with policy indicators.
- Keep the host's liquid navbar and theme transition wholly outside the map engine.
- Lazy-load large WebGL features and avoid mounting Hero and Explore simultaneously.

## Mandatory blocking verification before merging

1. Run `npm install`, `npm run typecheck`, `npm run test`, `npm run build` in this package. This environment could not download npm dependencies; none of these commands has been verified here.
2. Preview Hero and Explore on desktop/tablet/mobile, Figma visual comparison, keyboard region selection through host list, screen reader labeling, and route transitions.
3. Test toggle of reduced motion **while a map is already mounted**; visual islands/markers must remain present.
4. Test focus on an official feature with no supplied `focusLon` or `focusLat`, including a multipolygon region.
5. Validate real Data Hub payload contracts, admin level / code system / boundary edition / geometry winding & holes, and county/city scalability. The authoritativeness field in a client-supplied payload is **not cryptographic proof** of authoritative origin.
6. Check browser console, pointer interactions, WebGL context loss, performance, GPU memory growth, and scene cleanup under StrictMode and route switching.
7. Confirm source naming/tokens with host design system. Hero is **illustrative** even if the broader host application runs LIVE data mode.

## Known limitations and follow-up recommendations

- Runtime module dependencies cannot be installed in current environment (npm network inaccessible), so TypeScript semantic checking and real browser validation remain unverified.
- `onReady` is emitted when WebGL is initialized, not when geometry is fully built; adjust if host relies on all features being available.
- Placeholder WebGL failure state is a text panel, not a rendered static image. Improve with an approved visual fallback if landing requires one.
- Ring topology and self-intersection need deeper verification for official geometries; do not load arbitrary high-density polygons without simplification/benchmarking.
- An exact-size/survey map projection is **not** provided. The relief is procedural and illustrative.
- Hero has seven DEMO geographical groups with five larger main island groups, not exactly five separate mesh objects; review against Figma.
- Geometry rebuild on showCoastlines / devWireframe is currently straightforward but not optimal for very dense datasets.
- Browser interactions and map UI currently don't include complete automated accessibility tests; build these in the host.
