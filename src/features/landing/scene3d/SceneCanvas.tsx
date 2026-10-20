import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useEffectEvent, type ReactNode } from 'react';

import { ISOMETRIC_CAMERA_POSITION } from './sceneConstants';

interface SceneCanvasProps {
  readonly children: ReactNode;
  /** World units that must fit across the canvas width; drives the orthographic zoom. */
  readonly fitWidth: number;
  readonly onReady: () => void;
}

/** Keeps the orthographic zoom proportional to the canvas, so the scene scales with its zone. */
function FitToWidth({ fitWidth }: { readonly fitWidth: number }) {
  const width = useThree((state) => state.size.width);
  const get = useThree((state) => state.get);

  useEffect(() => {
    // three.js objects are mutable by design; read the live camera from the store, not a render value.
    const { camera, invalidate } = get();
    camera.zoom = width / fitWidth;
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, width, fitWidth]);

  return null;
}

/** Signals the zone once the first frame is on screen, so the static poster can fade out. */
function ReadySignal({ onReady }: { readonly onReady: () => void }) {
  const signal = useEffectEvent(onReady);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      signal();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

/**
 * Shared canvas setup: on-demand rendering (no frame is drawn unless something changed), a
 * bounded pixel ratio, flat colours (no tone mapping, so the palette stays exact) and a
 * transparent background so the page and its display mode show through.
 */
export function SceneCanvas({ children, fitWidth, onReady }: SceneCanvasProps) {
  return (
    <Canvas
      orthographic
      flat
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [...ISOMETRIC_CAMERA_POSITION], near: 0.1, far: 200, zoom: 40 }}
      style={{ width: '100%', height: '100%' }}
    >
      <FitToWidth fitWidth={fitWidth} />
      <ambientLight intensity={2.1} />
      <directionalLight position={[4, 10, 6]} intensity={1.6} />
      <directionalLight position={[-6, 4, -2]} intensity={0.35} />
      {children}
      <ReadySignal onReady={onReady} />
    </Canvas>
  );
}
