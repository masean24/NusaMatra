import dataColumnsGlassUrl from '@/assets/figma/landing/placeholder-data-columns-kaca.svg';
import dataColumnsUrl from '@/assets/figma/landing/placeholder-data-columns.svg';
import layeredIslandGlassUrl from '@/assets/figma/landing/placeholder-layered-island-kaca.svg';
import layeredIslandUrl from '@/assets/figma/landing/placeholder-layered-island.svg';

/**
 * Data-visualisation zones drawn by this app. The geographic dioramas (3D-1, 3D-5) belong to the
 * external 3D engine and render through `HeroDioramaSlot` instead.
 */
export type SceneKind = 'layeredIsland' | 'dataColumns';

/**
 * The approved Figma illustrations for each 3D zone, per display mode. They are the poster
 * shown while WebGL loads and the complete fallback on phones (as Figma 43:713 specifies),
 * without WebGL, or when a scene fails.
 */
export const STATIC_ART: Record<SceneKind, { normal: string; glass: string; width: number; height: number }> =
  {
    layeredIsland: { normal: layeredIslandUrl, glass: layeredIslandGlassUrl, width: 300, height: 260 },
    dataColumns: { normal: dataColumnsUrl, glass: dataColumnsGlassUrl, width: 300, height: 260 },
  };
