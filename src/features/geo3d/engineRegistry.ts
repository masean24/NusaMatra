import { lazy, type ComponentType } from 'react';
import type { Explore3DMapProps, HeroDioramaProps } from './contract';

/**
 * The single place where the external 3D engine is wired in. Each entry is loaded lazily, so
 * three.js and the engine download only when a slot that needs them mounts. Setting an entry
 * to `null` returns its slot to the static Figma placeholder (e.g. to ship without the engine).
 *
 * The engine (Gemini handoff, host copy in `src/features/map-3d/`) provides the landing hero and
 * the exploration map. It has no story scene, so the 3D-5 story band keeps its Figma illustration.
 * See docs/integration/geo3d-engine.md.
 */
export interface GeoEngineRegistry {
  readonly HeroDiorama: ComponentType<HeroDioramaProps> | null;
  readonly Explore3DMap: ComponentType<Explore3DMapProps> | null;
}

export const geoEngineRegistry: GeoEngineRegistry = {
  HeroDiorama: lazy(() =>
    import('./engineAdapters').then((module) => ({ default: module.HeroDioramaAdapter })),
  ),
  Explore3DMap: lazy(() =>
    import('./engineAdapters').then((module) => ({ default: module.Explore3DMapAdapter })),
  ),
};
