# Nusa Matra 3D — Reviewed Handoff Candidate

This package is assembled from the four Gemini outputs, with mechanical integration fixes. It is a **candidate for Claude Code integration**, not a verified production build.

## Install and run

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run dev
```

**Verification limitations:** This environment cannot reach npm registry, so external React/Three.js/Vite dependencies were not installed and the build/tests/browser preview have **not** been executed. Claude Code must perform all verification in its environment before merging.

## Files

- `src/NusaMatra3DMap.tsx`: One bundled source module with `NusaMatra3DMap`, `HeroDiorama`, `Explore3DMap`, projection, DEMO geometry, and validation.
- `src/NusaMatra3DMap.module.css`: Actual CSS Module; no runtime injection.
- `src/index.ts`: Public import surface.
- `src/demo/App.tsx`: Development preview only, not part of host website integration.
- `src/tests/geography.test.ts`: Basic geography checks; not a substitute for UI/E2E tests.

## Important host boundaries

- The map is an illustrative 3D presentation, **not** an authoritative geospatial dataset or real elevation map.
- 3D Hero remains illustrative. The Explore map can accept versioned, authenticated geography from the Data Hub once audited.
- No automatic API calls or unexpected DEMO/LIVE fallback.
- Mount `HeroDiorama` in the landing hero, `Explore3DMap` in the optional exploration mode.
- Host app owns Normal/Kaca switch, liquid animations, routing, region metadata, and data queries.

## Changes to Gemini source in this candidate

- CSS injection replaced by standard CSS Module import.
- Reduced-motion changes no longer destroy and rebuild the entire WebGL scene.
- Both DEMO and LIVE data-mode mismatch rejected; LIVE requires snapshot and provenance metadata.
- Camera focus falls back to approximate bounds center of real geometry instead of Indonesia's center.
- Pointer leaving the Explore canvas clears transient highlight.
- Added runnable Vite demo skeleton and basic tests. These **have not been executed**.

See `INTEGRATION-FOR-CLAUDE.md` for host steps and remaining review items.
