import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { BoxGeometry, MeshLambertMaterial, type Mesh } from 'three';
import { TOTAL_BASIS_POINTS } from '@/domain/prioritization';
import { observeOnce } from '@/features/motion';
import { boxMaterials } from '../models/boxMaterials';
import { useDisposable } from '../models/useDisposable';
import { SCENE_PALETTE } from '../palette';
import { SceneCanvas } from '../SceneCanvas';
import type { SceneProps } from '../sceneProps';

const COLUMN_WIDTH = 0.8;
/** How quickly a column closes the gap to its new height (per second, exponential). */
const COLUMN_SMOOTHING = 4;
const COLUMN_GAP = 0.55;
const MIN_HEIGHT = 0.3;
const MAX_EXTRA_HEIGHT = 4.6;
const BASE_HEIGHT = 0.36;

/** Column height follows the weight it represents (basis points of 10 000). */
function heightFor(basisPoints: number): number {
  return MIN_HEIGHT + (basisPoints / TOTAL_BASIS_POINTS) * MAX_EXTRA_HEIGHT;
}

function Columns({
  containerRef,
  reducedMotion,
  values,
}: Pick<SceneProps, 'containerRef' | 'reducedMotion' | 'values'>) {
  const weights = values ?? [];
  const grow = useRef(reducedMotion ? 1 : 0);
  const columns = useRef<(Mesh | null)[]>([]);

  const geometries = useDisposable(
    () => [new BoxGeometry(COLUMN_WIDTH, 1, COLUMN_WIDTH), new BoxGeometry(4.6, BASE_HEIGHT, 2.6)] as const,
    [],
  );
  const materials = useDisposable(
    () =>
      [
        new MeshLambertMaterial({ color: SCENE_PALETTE.orange, transparent: true, opacity: 0.86 }),
        new MeshLambertMaterial({ color: SCENE_PALETTE.orangeLight, transparent: true, opacity: 0.92 }),
        new MeshLambertMaterial({ color: SCENE_PALETTE.chalkTop }),
        new MeshLambertMaterial({ color: SCENE_PALETTE.chalk3 }),
      ] as const,
    [],
  );
  const [columnGeometry, baseGeometry] = geometries;
  const [glassSide, glassTop, baseTop, baseSide] = materials;

  const invalidate = useThree((state) => state.invalidate);

  // G5: columns rise from the base once the Lab band is on screen (with the weight bars). The
  // canvas only draws on demand, so each change asks for a frame.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || reducedMotion) return;
    return observeOnce(element, 0.2, () => {
      grow.current = 1;
      invalidate();
    });
  }, [containerRef, reducedMotion, invalidate]);

  // A new set of weights (another focus chosen, or the first load) starts the columns moving.
  const weightsKey = weights.join(',');
  useEffect(() => {
    invalidate();
  }, [weightsKey, invalidate]);

  // Each column glides to its own height, so switching focus reshapes the columns smoothly.
  useFrame((_, delta) => {
    let moving = false;
    for (const [index, column] of columns.current.entries()) {
      if (!column) continue;
      const goal = Math.max(0.001, heightFor(weights[index] ?? 0) * grow.current);
      const now = column.scale.y;
      const next = reducedMotion ? goal : now + (goal - now) * Math.min(1, delta * COLUMN_SMOOTHING);
      const height = Math.abs(goal - next) < 1e-3 ? goal : next;
      column.scale.y = height;
      column.position.y = BASE_HEIGHT / 2 + height / 2;
      if (height !== goal) moving = true;
    }
    if (moving) invalidate();
  });

  const offset = ((weights.length - 1) * (COLUMN_WIDTH + COLUMN_GAP)) / 2;

  return (
    <group position={[0, -2.2, 0]}>
      <mesh geometry={baseGeometry} material={boxMaterials(baseTop, baseSide)} />
      {weights.map((_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            columns.current[index] = element;
          }}
          geometry={columnGeometry}
          material={boxMaterials(glassTop, glassSide)}
          scale={[1, 0.001, 1]}
          position={[index * (COLUMN_WIDTH + COLUMN_GAP) - offset, BASE_HEIGHT / 2, 0]}
        />
      ))}
    </group>
  );
}

/** 3D-3 "Kolom data bergerak": glass-orange columns whose heights follow the chosen focus's weights. */
export default function DataColumnsScene({ onReady, containerRef, reducedMotion, values }: SceneProps) {
  return (
    <SceneCanvas fitWidth={8.5} onReady={onReady}>
      <Columns containerRef={containerRef} reducedMotion={reducedMotion} values={values} />
    </SceneCanvas>
  );
}
