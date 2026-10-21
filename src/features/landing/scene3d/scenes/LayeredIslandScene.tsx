import { useRef, type ReactNode, type Ref } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshLambertMaterial,
  SphereGeometry,
  TorusGeometry,
  type Group,
} from 'three';
import { islandShape } from '../models/islandShape';
import { useDisposable } from '../models/useDisposable';
import { SCENE_PALETTE } from '../palette';
import { SceneCanvas } from '../SceneCanvas';
import type { SceneProps } from '../sceneProps';
import { useDamped } from '../useDamped';
import { useScrollProgress } from '../useScrollProgress';

/**
 * The three layers of 3D-2 are the Nusa Matra process, bottom to top:
 *  1. Data & Sumber       (chalk slab, a field of small source points),
 *  2. Analisis & Simulasi (cobalt slab, a few simulation bars),
 *  3. Keputusan & Bukti   (orange slab, an evidence seal).
 * Three thin posts join the layers once they open, so it reads as one modular system. The object
 * carries no text: the cues are its form, and the section's caption names the layers.
 */
const LAYERS = [
  { key: 'data-sumber', color: SCENE_PALETTE.chalkTop, side: SCENE_PALETTE.chalk3, opacity: 1 },
  { key: 'analisis-simulasi', color: SCENE_PALETTE.seaShallow, side: SCENE_PALETTE.sea, opacity: 0.88 },
  { key: 'keputusan-bukti', color: SCENE_PALETTE.orangeLight, side: SCENE_PALETTE.orange, opacity: 0.92 },
] as const;

const LAYER_THICKNESS = 0.32;
/** Gap between layers when fully opened, in world units. */
const OPEN_GAP = 1.5;
/** Where the three connecting posts stand (the same x/z on every layer). */
const ANCHORS = [
  { x: -0.85, z: 0.55 },
  { x: 0.75, z: -0.5 },
  { x: 0.05, z: 0.05 },
] as const;
/** Source points: a quiet 4 × 3 field on the bottom layer, clear of the posts. */
const SOURCE_POINTS = [-1.05, -0.35, 0.35, 1.05].flatMap((x) => [-0.95, 0.2, 1.0].map((z) => ({ x, z })));
const SIMULATION_BARS = [
  { x: -1.0, height: 0.26 },
  { x: -0.5, height: 0.52 },
  { x: 0, height: 0.36 },
  { x: 0.5, height: 0.72 },
  { x: 1.0, height: 0.44 },
] as const;
const TOP = LAYER_THICKNESS;

interface DataLayerProps {
  readonly layer: (typeof LAYERS)[number];
  readonly geometry: ExtrudeGeometry;
  readonly children?: ReactNode;
  readonly ref?: Ref<Group>;
}

/** One translucent slab of the island; owns (and disposes) its own cap and side materials. */
function DataLayer({ layer, geometry, children, ref }: DataLayerProps) {
  const materials = useDisposable(
    () =>
      [
        new MeshLambertMaterial({
          color: layer.color,
          transparent: layer.opacity < 1,
          opacity: layer.opacity,
        }),
        new MeshLambertMaterial({
          color: layer.side,
          transparent: layer.opacity < 1,
          opacity: layer.opacity,
        }),
      ] as const,
    [layer],
  );
  return (
    <group ref={ref ?? null}>
      <mesh geometry={geometry} material={[...materials]} />
      {children}
    </group>
  );
}

function SplittingIsland({
  containerRef,
  reducedMotion,
}: Pick<SceneProps, 'containerRef' | 'reducedMotion'>) {
  const progress = useScrollProgress(containerRef);
  const lift = useRef<Group>(null);
  const layerRefs = useRef<(Group | null)[]>([]);
  /** Posts between layer i and i + 1, one per anchor. */
  const postRefs = useRef<(Group | null)[][]>([[], []]);
  const setPost = (layer: number, index: number, element: Group | null) => {
    const posts = postRefs.current[layer];
    if (posts) posts[index] = element;
  };

  const geometry = useDisposable(() => {
    const extruded = new ExtrudeGeometry(islandShape(71, 2.2, 0.16, 10), {
      depth: LAYER_THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 48,
    });
    extruded.rotateX(-Math.PI / 2);
    return extruded;
  }, []);
  const pointGeometry = useDisposable(() => new CylinderGeometry(0.1, 0.1, 0.06, 18), []);
  const nodeGeometry = useDisposable(() => new SphereGeometry(0.12, 18, 14), []);
  const postGeometry = useDisposable(() => new CylinderGeometry(0.04, 0.04, 1, 12), []);
  const barGeometry = useDisposable(() => new BoxGeometry(0.26, 1, 0.26), []);
  const sealRingGeometry = useDisposable(() => {
    const ring = new TorusGeometry(0.36, 0.045, 12, 48);
    ring.rotateX(Math.PI / 2);
    return ring;
  }, []);
  const sealCoreGeometry = useDisposable(() => new CylinderGeometry(0.2, 0.2, 0.06, 28), []);
  const sourceMaterial = useDisposable(() => new MeshLambertMaterial({ color: SCENE_PALETTE.chalk4 }), []);
  const nodeMaterial = useDisposable(() => new MeshLambertMaterial({ color: SCENE_PALETTE.peach }), []);
  const postMaterial = useDisposable(
    () => new MeshLambertMaterial({ color: SCENE_PALETTE.peach, transparent: true, opacity: 0.85 }),
    [],
  );
  const barMaterial = useDisposable(() => new MeshLambertMaterial({ color: SCENE_PALETTE.chalkTop }), []);
  const sealMaterial = useDisposable(() => new MeshLambertMaterial({ color: SCENE_PALETTE.chalkTop }), []);
  const sealCoreMaterial = useDisposable(
    () => new MeshLambertMaterial({ color: SCENE_PALETTE.orangeDeep }),
    [],
  );

  // G4: the island rises, then opens into three layers as the section scrolls; reduced motion shows it open.
  useDamped(
    progress,
    (value) => {
      const opened = reducedMotion ? 1 : value;
      if (lift.current) lift.current.position.y = -2.1 + Math.min(1, opened * 2) * 0.5;
      const spread = Math.max(0, Math.min(1, (opened - 0.25) / 0.75));
      const gap = spread * OPEN_GAP;
      layerRefs.current.forEach((layer, index) => {
        if (!layer) return;
        layer.position.y = index * (LAYER_THICKNESS + gap);
        layer.rotation.y = (index - 1) * spread * 0.12;
      });
      // The posts grow with the gap and are hidden while the layers are still closed.
      postRefs.current.forEach((posts) => {
        posts.forEach((post) => {
          if (!post) return;
          post.visible = gap > 0.03;
          post.position.y = TOP + gap / 2;
          post.scale.y = Math.max(gap, 1e-3);
        });
      });
    },
    { instant: reducedMotion },
  );

  const nodes = ANCHORS.map((anchor) => (
    <mesh
      key={`${anchor.x}:${anchor.z}`}
      geometry={nodeGeometry}
      material={nodeMaterial}
      position={[anchor.x, TOP + 0.04, anchor.z]}
    />
  ));

  return (
    <group ref={lift}>
      {/* 1 · Data & Sumber */}
      <DataLayer
        layer={LAYERS[0]}
        geometry={geometry}
        ref={(element) => {
          layerRefs.current[0] = element;
        }}
      >
        {SOURCE_POINTS.map((point) => (
          <mesh
            key={`${point.x}:${point.z}`}
            geometry={pointGeometry}
            material={sourceMaterial}
            position={[point.x, TOP + 0.025, point.z]}
          />
        ))}
        {nodes}
        {ANCHORS.map((anchor, anchorIndex) => (
          <group
            key={`post-0-${String(anchorIndex)}`}
            position={[anchor.x, TOP, anchor.z]}
            ref={(element) => {
              setPost(0, anchorIndex, element);
            }}
          >
            <mesh geometry={postGeometry} material={postMaterial} />
          </group>
        ))}
      </DataLayer>

      {/* 2 · Analisis & Simulasi */}
      <DataLayer
        layer={LAYERS[1]}
        geometry={geometry}
        ref={(element) => {
          layerRefs.current[1] = element;
        }}
      >
        {SIMULATION_BARS.map((bar) => (
          <mesh
            key={bar.x}
            geometry={barGeometry}
            material={barMaterial}
            position={[bar.x, TOP + bar.height / 2, 1.05]}
            scale={[1, bar.height, 1]}
          />
        ))}
        {nodes}
        {ANCHORS.map((anchor, anchorIndex) => (
          <group
            key={`post-1-${String(anchorIndex)}`}
            position={[anchor.x, TOP, anchor.z]}
            ref={(element) => {
              setPost(1, anchorIndex, element);
            }}
          >
            <mesh geometry={postGeometry} material={postMaterial} />
          </group>
        ))}
      </DataLayer>

      {/* 3 · Keputusan & Bukti */}
      <DataLayer
        layer={LAYERS[2]}
        geometry={geometry}
        ref={(element) => {
          layerRefs.current[2] = element;
        }}
      >
        <mesh geometry={sealRingGeometry} material={sealMaterial} position={[0.05, TOP + 0.05, 0.3]} />
        <mesh geometry={sealCoreGeometry} material={sealCoreMaterial} position={[0.05, TOP + 0.03, 0.3]} />
        {nodes}
      </DataLayer>
    </group>
  );
}

/** 3D-2: the three-layer object of the process (data → analysis → decision). */
export default function LayeredIslandScene({ onReady, containerRef, reducedMotion }: SceneProps) {
  return (
    <SceneCanvas fitWidth={8.6} onReady={onReady}>
      <SplittingIsland containerRef={containerRef} reducedMotion={reducedMotion} />
    </SceneCanvas>
  );
}
