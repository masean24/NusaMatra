import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { HeroHexMapProps } from '@/features/geo3d';
import { useRevealOnce } from '@/features/motion';
import { HERO_CAMERA_POSITION, HERO_FOV, HERO_TARGET } from '@/lib/heroMapCamera';
import { supportsWebGL } from '@/lib/webglSupport';
import { hexDatasetUrl, loadHexDatasetOnce, type HexDataset } from './hexDataset';
import { HexGraticule } from './HexGraticule';
import { HexScene } from './HexScene';
import styles from './HexIndonesiaMap.module.css';

/** The entrance plays once, when this share of the zone is on screen. */
const VISIBLE_THRESHOLD = 0.3;

/** Development only: lets a performance script read the renderer's draw-call and triangle counts. */
function DevRendererStats() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as unknown as { __nmHexStats?: () => unknown };
    target.__nmHexStats = () => ({
      render: { ...gl.info.render },
      memory: { ...gl.info.memory },
      programs: gl.info.programs?.length ?? 0,
    });
    return () => {
      delete target.__nmHexStats;
    };
  }, [gl]);
  return null;
}

/**
 * Landing hero map: Indonesia as extruded hexagons with SIMULATED values (see `hexDataset.ts`),
 * floating over the page with no frame behind it. It loads its grid, renders on demand, and reports
 * `onError` when WebGL, the data or the GL context is lost, so the slot shows the hexagon poster.
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
  const [inView, setInView] = useState(true);
  const { ref, revealed } = useRevealOnce<HTMLDivElement>(VISIBLE_THRESHOLD);
  const observedRef = useRef<HTMLDivElement | null>(null);
  // Read from event listeners added once at canvas creation, so they always see the latest handler.
  const errorRef = useRef(onError);
  useLayoutEffect(() => {
    errorRef.current = onError;
  });
  const reportError = useEffectEvent((error: unknown) => {
    onError?.(error);
  });

  useEffect(() => {
    if (!supportsWebGL()) {
      reportError(new Error('WebGL tidak tersedia'));
      return;
    }
    let cancelled = false;
    // The poster shown while this scene loads already requested the same grid; this reuses it.
    loadHexDatasetOnce(hexDatasetUrl()).then(
      (loaded) => {
        if (!cancelled) setDataset(loaded);
      },
      (error: unknown) => {
        if (!cancelled) reportError(error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Live visibility (the reveal hook only fires once): a theme change while the hero is off
  // screen is applied without playing the wave.
  useEffect(() => {
    const element = observedRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      const last = entries.at(-1);
      if (last) setInView(last.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={(node) => {
        ref.current = node;
        observedRef.current = node;
      }}
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-display-mode={displayMode}
    >
      <HexGraticule />
      {dataset && (
        <div className={styles.canvasBox}>
          <Canvas
            shadows="variance"
            flat
            frameloop="demand"
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            camera={{ position: [...HERO_CAMERA_POSITION], fov: HERO_FOV, near: 1, far: 400 }}
            onCreated={({ camera, gl }) => {
              camera.lookAt(...HERO_TARGET);
              // A lost GL context leaves a blank canvas; hand over to the poster instead.
              gl.domElement.addEventListener('webglcontextlost', (event) => {
                event.preventDefault();
                errorRef.current?.(new Error('Konteks WebGL hilang'));
              });
            }}
          >
            <DevRendererStats />
            <HexScene
              dataset={dataset}
              displayMode={displayMode}
              reducedMotion={reducedMotion}
              started={revealed}
              inView={inView}
              onFirstFrame={() => {
                onReady?.();
              }}
              onEntranceSettled={() => {
                onEntranceSettled?.();
              }}
            />
          </Canvas>
        </div>
      )}
      <p className={styles.badge}>Garis pantai: Natural Earth · Sel hexagon: data simulasi</p>
    </div>
  );
}
