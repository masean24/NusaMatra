import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh, type LineDashedMaterial, type LineSegments } from 'three';
import type { HexCell, HexDataset } from './hexDataset';
import { valueToRgb } from './hexColors';
import {
  ENTRANCE_TOTAL_MS,
  REDUCED_FADE_MS,
  SETTLED_POSE,
  buildEntranceSchedule,
  evaluateEntrance,
  evaluateReducedEntrance,
  type CellPose,
} from './hexEntrance';

/** A thin gap between neighbouring hexagons. */
const HEX_FILL = 0.93;
const BASE_HEIGHT = 0.22;
const HEIGHT_RANGE = 0.5;
const HOVER_LIFT = 0.2;
const HOVER_BRIGHTEN = 0.16;
/** How fast hover lift eases in and out (share of the remaining distance per frame). */
const LIFT_EASE = 0.22;
const LIFT_EPSILON = 0.002;
const NO_DATA_OPACITY = 0.8;
/** A blinking cell flashes towards white (instances have no per-instance alpha; scale hides them before they appear). */
const BLINK_COLOR = new Color('#ffffff');
const BLINK_STRENGTH = 0.85;

interface HexSceneProps {
  readonly dataset: HexDataset;
  readonly reducedMotion: boolean;
  /** The entrance starts when this turns true (the card scrolled into view). */
  readonly started: boolean;
  readonly onFirstFrame: () => void;
  readonly onEntranceSettled: () => void;
}

interface DrawnCell {
  readonly cell: HexCell;
  readonly height: number;
  readonly color: Color;
}

function hexOutline(cells: readonly HexCell[], radius: number): Float32Array {
  const positions = new Float32Array(cells.length * 6 * 2 * 3);
  let offset = 0;
  for (const cell of cells) {
    // Pointy-top: a vertex points along +z.
    for (let side = 0; side < 6; side += 1) {
      for (const corner of [side, side + 1]) {
        const angle = (Math.PI / 3) * corner;
        positions[offset++] = cell.x + radius * Math.sin(angle);
        positions[offset++] = 0.03;
        positions[offset++] = cell.z + radius * Math.cos(angle);
      }
    }
  }
  return positions;
}

/**
 * All hexagons are ONE InstancedMesh. The entrance and the hover lift are evaluated for every
 * instance inside one `useFrame`, then written to `instanceMatrix`/`instanceColor`; nothing here
 * allocates a mesh or a tween per hexagon, and nothing renders once everything is at rest.
 */
export function HexScene({
  dataset,
  reducedMotion,
  started,
  onFirstFrame,
  onEntranceSettled,
}: HexSceneProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const outlineRef = useRef<LineSegments>(null);
  const outlineMaterialRef = useRef<LineDashedMaterial>(null);
  const hovered = useRef(-1);
  const startTime = useRef<number | null>(null);
  const settled = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const firstFrameRef = useRef(onFirstFrame);
  const settledRef = useRef(onEntranceSettled);
  useLayoutEffect(() => {
    firstFrameRef.current = onFirstFrame;
    settledRef.current = onEntranceSettled;
  });

  const radius = dataset.hexSizeDeg * HEX_FILL;

  const { drawn, noData, schedule } = useMemo(() => {
    const withData: DrawnCell[] = [];
    const without: HexCell[] = [];
    for (const cell of dataset.cells) {
      if (cell.hasData && cell.value !== null) {
        const [r, g, b] = valueToRgb(cell.value);
        withData.push({
          cell,
          height: BASE_HEIGHT + cell.value * HEIGHT_RANGE,
          color: new Color(r / 255, g / 255, b / 255),
        });
      } else {
        without.push(cell);
      }
    }
    return {
      drawn: withData,
      noData: without,
      schedule: buildEntranceSchedule(withData.map((item) => item.cell.x)),
    };
  }, [dataset]);
  const outline = useMemo(() => hexOutline(noData, radius), [noData, radius]);
  // Dashes need cumulative edge lengths, which three.js computes from the attached positions.
  useLayoutEffect(() => {
    outlineRef.current?.computeLineDistances();
  }, [outline]);

  const liftsRef = useRef(new Float32Array(0));
  useLayoutEffect(() => {
    liftsRef.current = new Float32Array(drawn.length);
  }, [drawn.length]);
  const dummy = useMemo(() => new Object3D(), []);
  const scratch = useMemo(() => new Color(), []);

  const writeInstance = (index: number, pose: CellPose) => {
    const mesh = meshRef.current;
    const item = drawn[index];
    if (!mesh || !item) return;
    const lift = liftsRef.current[index] ?? 0;
    const height = (item.height + lift * HOVER_LIFT) * pose.scale;
    dummy.position.set(item.cell.x + pose.offsetX, height / 2 + pose.offsetY, item.cell.z + pose.offsetZ);
    dummy.scale.set(Math.max(pose.scale, 1e-4), Math.max(height, 1e-4), Math.max(pose.scale, 1e-4));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);

    scratch.copy(item.color).multiplyScalar(1 + lift * HOVER_BRIGHTEN);
    scratch.lerp(BLINK_COLOR, (1 - pose.opacity) * BLINK_STRENGTH);
    mesh.setColorAt(index, scratch);
  };

  // Hidden until the entrance starts, so there is no flash of the finished map.
  useLayoutEffect(() => {
    if (startTime.current !== null) return;
    drawn.forEach((_, index) => {
      writeInstance(index, { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 0, opacity: 0 });
    });
    const mesh = meshRef.current;
    if (mesh) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- writeInstance is a stable closure over memoised values
  }, [drawn, invalidate]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      firstFrameRef.current();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!started || startTime.current !== null) return;
    startTime.current = performance.now();
    invalidate();
  }, [started, invalidate]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || startTime.current === null) return;
    const elapsed = performance.now() - startTime.current;
    const total = reducedMotion ? REDUCED_FADE_MS : ENTRANCE_TOTAL_MS;
    const entering = elapsed < total;

    // One last write at rest puts every cell exactly on its grid slot.
    const finalising = !entering && !settled.current;
    let moving = entering;
    for (let index = 0; index < drawn.length; index += 1) {
      const target = index === hovered.current ? 1 : 0;
      const lift = liftsRef.current[index] ?? 0;
      const liftChanging = Math.abs(target - lift) > LIFT_EPSILON;
      if (liftChanging) {
        liftsRef.current[index] = lift + (target - lift) * LIFT_EASE;
        moving = true;
      } else if (lift !== target) {
        liftsRef.current[index] = target;
      }
      if (!entering && !finalising && !liftChanging && lift === target) continue;
      const entrance = schedule[index];
      const pose = !entering
        ? SETTLED_POSE
        : reducedMotion || !entrance
          ? evaluateReducedEntrance(elapsed)
          : evaluateEntrance(entrance, elapsed);
      writeInstance(index, pose);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const outlineMaterial = outlineMaterialRef.current;
    if (outlineMaterial) {
      const progress = reducedMotion ? elapsed / REDUCED_FADE_MS : (elapsed - 300) / 700;
      outlineMaterial.opacity = NO_DATA_OPACITY * Math.min(1, Math.max(0, progress));
    }

    if (!entering && !settled.current) {
      settled.current = true;
      settledRef.current();
    }
    if (moving) state.invalidate();
  });

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const index = event.instanceId ?? -1;
    if (index !== hovered.current) {
      hovered.current = index;
      invalidate();
    }
  };
  const handleOut = () => {
    hovered.current = -1;
    invalidate();
  };

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[-30, 55, 38]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0006}
      />
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, drawn.length]}
        castShadow
        receiveShadow
        onPointerMove={handleMove}
        onPointerOut={handleOut}
      >
        <cylinderGeometry args={[radius, radius, 1, 6]} />
        <meshStandardMaterial roughness={0.7} metalness={0} />
      </instancedMesh>
      <lineSegments ref={outlineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outline, 3]} />
        </bufferGeometry>
        <lineDashedMaterial
          ref={outlineMaterialRef}
          color="#ffffff"
          dashSize={0.14}
          gapSize={0.1}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[110, 70]} />
        <shadowMaterial opacity={0.22} />
      </mesh>
    </>
  );
}
