import { useEffect, useRef } from 'react';
import { BoxGeometry, MeshLambertMaterial, type Mesh } from 'three';
import { TOTAL_BASIS_POINTS } from '@/domain/prioritization';
import { observeOnce } from '@/features/motion';
import { boxMaterials } from '../models/boxMaterials';
import { useDisposable } from '../models/useDisposable';
import { SCENE_PALETTE } from '../palette';
import { SceneCanvas } from '../SceneCanvas';
import type { SceneProps } from '../sceneProps';
import { useDamped } from '../useDamped';

const COLUMN_WIDTH = 0.8;
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

  // G5: columns rise from the base once the Lab band is on screen (with the weight bars).
  useEffect(() => {
    const element = containerRef.current;
    if (!element || reducedMotion) return;
    return observeOnce(element, 0.2, () => {
      grow.current = 1;
    });
  }, [containerRef, reducedMotion]);

  useDamped(
    grow,
    (value) => {
      columns.current.forEach((column, index) => {
        if (!column) return;
        const height = heightFor(weights[index] ?? 0) * Math.max(0.001, value);
        column.scale.y = height;
        column.position.y = BASE_HEIGHT / 2 + height / 2;
      });
    },
    { smoothing: 4, instant: reducedMotion },
  );

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
          position={[index * (COLUMN_WIDTH + COLUMN_GAP) - offset, BASE_HEIGHT / 2, 0]}
        />
      ))}
    </group>
  );
}

/** 3D-3 "Kolom data bergerak": glass-orange columns whose heights follow the demo weights. */
export default function DataColumnsScene({ onReady, containerRef, reducedMotion, values }: SceneProps) {
  return (
    <SceneCanvas fitWidth={8.5} onReady={onReady}>
      <Columns containerRef={containerRef} reducedMotion={reducedMotion} values={values} />
    </SceneCanvas>
  );
}
