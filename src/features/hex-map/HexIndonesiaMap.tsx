import { Canvas } from '@react-three/fiber';
import { useEffect, useEffectEvent, useState } from 'react';
import { supportsWebGL } from '@/lib/webglSupport';
import { useRevealOnce } from '@/features/motion';
import type { HeroHexMapProps } from '@/features/geo3d';
import { loadHexDataset, type HexDataset } from './hexDataset';
import { HexGraticule } from './HexGraticule';
import { HexScene } from './HexScene';
import { HERO_CAMERA_POSITION, HERO_FOV, HERO_TARGET } from '@/lib/heroMapCamera';
import styles from './HexIndonesiaMap.module.css';

const DATASET_URL = `${import.meta.env.BASE_URL}data/hex-indonesia.json`;
/** The entrance plays once, when this share of the zone is on screen. */
const VISIBLE_THRESHOLD = 0.3;

/**
 * Landing hero map: Indonesia as extruded hexagons with SIMULATED values (see `hexDataset.ts`).
 * It loads its grid, renders on demand, and reports `onError` when WebGL or the data is unavailable,
 * so the slot can fall back to the previous relief map.
 */
export function HexIndonesiaMap({
  displayMode,
  reducedMotion,
  className,
  onReady,
  onError,
  onEntranceSettled,
}: HeroHexMapProps) {
  const [dataset, setDataset] = useState<HexDataset | null>(null);
  const { ref, revealed } = useRevealOnce<HTMLDivElement>(VISIBLE_THRESHOLD);
  const reportError = useEffectEvent((error: unknown) => {
    onError?.(error);
  });

  useEffect(() => {
    if (!supportsWebGL()) {
      reportError(new Error('WebGL tidak tersedia'));
      return;
    }
    const controller = new AbortController();
    loadHexDataset(DATASET_URL, controller.signal).then(setDataset, (error: unknown) => {
      if (!controller.signal.aborted) reportError(error);
    });
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-display-mode={displayMode}
    >
      <HexGraticule />
      {dataset && (
        <Canvas
          className={styles.canvas}
          shadows="percentage"
          flat
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          camera={{ position: [...HERO_CAMERA_POSITION], fov: HERO_FOV, near: 1, far: 400 }}
          onCreated={({ camera }) => {
            camera.lookAt(...HERO_TARGET);
          }}
        >
          <HexScene
            dataset={dataset}
            reducedMotion={reducedMotion}
            started={revealed}
            onFirstFrame={() => {
              onReady?.();
            }}
            onEntranceSettled={() => {
              onEntranceSettled?.();
            }}
          />
        </Canvas>
      )}
      <p className={styles.badge}>Garis pantai: Natural Earth · Sel hexagon: data simulasi</p>
    </div>
  );
}
