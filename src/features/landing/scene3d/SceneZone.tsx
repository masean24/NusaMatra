import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { STAGGER_ITEM_PROPS, useMediaQuery, useReducedMotion } from '@/features/motion';
import { useDisplayMode } from '@/features/theme';
import { RenderErrorBoundary } from '@/components/feedback/RenderErrorBoundary';
import type { SceneProps } from './sceneProps';
import { STATIC_ART, type SceneKind } from './staticArt';
import { supportsWebGL, whenIdle } from './webglSupport';
import styles from './SceneZone.module.css';

/* Each scene is its own chunk; three.js only downloads when the first zone comes near the viewport. */
const SCENES: Record<SceneKind, ComponentType<SceneProps>> = {
  layeredIsland: lazy(() => import('./scenes/LayeredIslandScene')),
  dataColumns: lazy(() => import('./scenes/DataColumnsScene')),
};

/** Figma 43:713: phones get the still image instead of WebGL. */
const STATIC_ONLY_QUERY = '(width < 768px)';

interface SceneZoneProps {
  readonly kind: SceneKind;
  /** Plain-language description of the illustration for screen readers. */
  readonly description: string;
  readonly className?: string | undefined;
  /** Inputs a scene may react to (e.g. demo weights in basis points for the data columns). */
  readonly values?: readonly number[];
}

/**
 * A 3D zone from the Figma annotations. It shows the approved static illustration first, loads
 * the WebGL scene only near the viewport, unmounts it again when far away (freeing the GPU
 * context), and falls back to the illustration on phones, without WebGL, or on any scene error.
 */
export function SceneZone({ kind, description, className, values }: SceneZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const isCompact = useMediaQuery(STATIC_ONLY_QUERY);
  const reducedMotion = useReducedMotion();
  const { mode } = useDisplayMode();
  const canRender3d = !isCompact && supportsWebGL();

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !canRender3d || typeof IntersectionObserver === 'undefined') return;
    let observer: IntersectionObserver | null = null;
    // Boot WebGL only once the page is idle, so the hero text and first paint never wait on it.
    const start = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          const near = entry?.isIntersecting ?? false;
          setIsNear(near);
          if (!near) setSceneReady(false);
        },
        { rootMargin: '60% 0px' },
      );
      observer.observe(element);
    };
    const idle = whenIdle(start);
    return () => {
      idle.cancel();
      observer?.disconnect();
    };
  }, [canRender3d]);

  const art = STATIC_ART[kind];
  const poster = (
    <img
      className={styles.poster}
      src={art[mode]}
      alt=""
      width={art.width}
      height={art.height}
      loading="lazy"
      decoding="async"
      data-hidden={sceneReady || undefined}
    />
  );
  const Scene = SCENES[kind];
  const showScene = canRender3d && isNear;

  return (
    <div
      ref={containerRef}
      className={[styles.zone, styles[kind], className].filter(Boolean).join(' ')}
      data-kind={kind}
      {...STAGGER_ITEM_PROPS}
    >
      <p className="visually-hidden">{description}</p>
      {poster}
      {showScene && (
        <RenderErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <div className={styles.canvas} data-ready={sceneReady || undefined} aria-hidden="true">
              <Scene
                containerRef={containerRef}
                mode={mode}
                reducedMotion={reducedMotion}
                values={values}
                onReady={() => {
                  setSceneReady(true);
                }}
              />
            </div>
          </Suspense>
        </RenderErrorBoundary>
      )}
    </div>
  );
}
