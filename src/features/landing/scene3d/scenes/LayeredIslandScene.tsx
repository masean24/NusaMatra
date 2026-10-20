import { useRef, type ReactNode, type Ref } from 'react';
import { CylinderGeometry, ExtrudeGeometry, MeshLambertMaterial, type Group } from 'three';
import { islandShape } from '../models/islandShape';
import { useDisposable } from '../models/useDisposable';
import { SCENE_PALETTE } from '../palette';
import { SceneCanvas } from '../SceneCanvas';
import type { SceneProps } from '../sceneProps';
import { useDamped } from '../useDamped';
import { useScrollProgress } from '../useScrollProgress';

/** The three data layers of 3D-2, bottom to top: services, social, risk. */
const LAYERS = [
  { key: 'layanan', color: SCENE_PALETTE.chalkTop, side: SCENE_PALETTE.chalk3, opacity: 1 },
  { key: 'sosial', color: SCENE_PALETTE.seaShallow, side: SCENE_PALETTE.sea, opacity: 0.88 },
  { key: 'risiko', color: SCENE_PALETTE.orangeLight, side: SCENE_PALETTE.orange, opacity: 0.9 },
] as const;

const LAYER_THICKNESS = 0.32;
/** Gap between layers when fully opened, in world units. */
const OPEN_GAP = 1.15;
const MARKERS = [
  { layer: 1, x: -0.9, z: 0.6 },
  { layer: 2, x: 0.8, z: -0.4 },
] as const;

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
  const markerGeometry = useDisposable(() => new CylinderGeometry(0.16, 0.16, 0.14, 24), []);
  const markerMaterial = useDisposable(() => new MeshLambertMaterial({ color: SCENE_PALETTE.orange }), []);

  // G4: the island rises, then opens into three layers as the section scrolls; reduced motion shows it open.
  useDamped(
    progress,
    (value) => {
      const opened = reducedMotion ? 1 : value;
      if (lift.current) lift.current.position.y = -2.1 + Math.min(1, opened * 2) * 0.5;
      layerRefs.current.forEach((layer, index) => {
        if (!layer) return;
        const spread = Math.max(0, Math.min(1, (opened - 0.25) / 0.75));
        layer.position.y = index * (LAYER_THICKNESS + spread * OPEN_GAP);
        layer.rotation.y = (index - 1) * spread * 0.12;
      });
    },
    { instant: reducedMotion },
  );

  return (
    <group ref={lift}>
      {LAYERS.map((layer, index) => (
        <DataLayer
          key={layer.key}
          ref={(element) => {
            layerRefs.current[index] = element;
          }}
          layer={layer}
          geometry={geometry}
        >
          {MARKERS.filter((marker) => marker.layer === index).map((marker) => (
            <mesh
              key={`${marker.x}:${marker.z}`}
              geometry={markerGeometry}
              material={markerMaterial}
              position={[marker.x, LAYER_THICKNESS + 0.1, marker.z]}
            />
          ))}
        </DataLayer>
      ))}
    </group>
  );
}

/** 3D-2 "Pulau berlapis data". */
export default function LayeredIslandScene({ onReady, containerRef, reducedMotion }: SceneProps) {
  return (
    <SceneCanvas fitWidth={10.5} onReady={onReady}>
      <SplittingIsland containerRef={containerRef} reducedMotion={reducedMotion} />
    </SceneCanvas>
  );
}
