import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  CanvasTexture,
  ExtrudeGeometry,
  PlaneGeometry,
  Object3D,
  Shape,
  type AmbientLight,
  type DirectionalLight,
  type HemisphereLight,
  type InstancedMesh,
  type LineDashedMaterial,
  type LineSegments,
  type MeshBasicMaterial,
  type ShadowMaterial,
} from 'three';
import type { HexCell, HexDataset } from './hexDataset';
import { HEX_FILL, tileHeight } from './hexStyle';
import {
  lerpLightRig,
  lightRigFor,
  valueToRgb,
  type HexLightRig,
  type HexTheme,
  type Rgb,
} from './hexColors';
import {
  ENTRANCE_TOTAL_MS,
  REDUCED_FADE_MS,
  SETTLED_POSE,
  buildEntranceSchedule,
  evaluateEntrance,
  evaluateReducedEntrance,
  type CellPose,
} from './hexEntrance';
import {
  THEME_SETTLED,
  THEME_START_DELAY_MS,
  buildThemeWave,
  evaluateThemeWave,
  themeTransitionDuration,
  type ThemeFx,
} from './hexThemeWave';

/** Tile height and the motions below are fractions of the hexagon size, so they hold at any density. */
const HOVER_LIFT = 0.45;
const HOVER_BRIGHTEN = 0.14;
const WAVE_LIFT = 0.6;
const WAVE_TILT = 0.2;
const WAVE_GLOW = 0.2;
/** The entrance's shake offsets were tuned for 0.8° cells; they scale with the cell size. */
const ENTRANCE_TUNED_SIZE = 0.8;
const BEVEL = 0.1;
/** Contact shadows are this much stronger than the cast ground shadow (which is kept faint). */
const CONTACT_STRENGTH = 1.7;

/** A soft round spot, white in the middle and transparent at the edge: the shape of a contact shadow. */
function createSoftSpotTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}
/** How fast hover lift eases in and out (share of the remaining distance per frame). */
const LIFT_EASE = 0.22;
const LIFT_EPSILON = 0.002;
/** A blinking cell flashes towards white (instances have no per-instance alpha). */
const WHITE = new Color('#ffffff');
const BLINK_STRENGTH = 0.85;

interface HexSceneProps {
  readonly dataset: HexDataset;
  readonly displayMode: HexTheme;
  readonly reducedMotion: boolean;
  /** The entrance starts when this turns true (the card scrolled into view). */
  readonly started: boolean;
  /** Whether any of the hero is on screen; a theme change off screen is applied without animating. */
  readonly inView: boolean;
  readonly onFirstFrame: () => void;
  readonly onEntranceSettled: () => void;
}

interface DrawnCell {
  readonly cell: HexCell;
  readonly height: number;
}

function hexOutline(cells: readonly HexCell[], radius: number, y: number): Float32Array {
  const positions = new Float32Array(cells.length * 6 * 2 * 3);
  let offset = 0;
  for (const cell of cells) {
    // Pointy-top: a vertex points along +z.
    for (let side = 0; side < 6; side += 1) {
      for (const corner of [side, side + 1]) {
        const angle = (Math.PI / 3) * corner;
        positions[offset++] = cell.x + radius * Math.sin(angle);
        positions[offset++] = y;
        positions[offset++] = cell.z + radius * Math.cos(angle);
      }
    }
  }
  return positions;
}

/** A unit-height hexagonal prism with softly bevelled edges, standing on y = 0, pointy along z. */
function createHexPrism(radius: number): ExtrudeGeometry {
  const bevelSize = radius * BEVEL;
  const shapeRadius = radius - bevelSize;
  const shape = new Shape();
  for (let corner = 0; corner < 6; corner += 1) {
    const angle = Math.PI / 2 + (Math.PI / 3) * corner;
    const x = shapeRadius * Math.cos(angle);
    const y = shapeRadius * Math.sin(angle);
    if (corner === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const bevelThickness = 0.06;
  const geometry = new ExtrudeGeometry(shape, {
    depth: 1 - 2 * bevelThickness,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevelThickness, 0);
  return geometry;
}

const rgbArray = (rgb: Rgb) => [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255] as const;

/**
 * All hexagons are ONE InstancedMesh. The entrance, the hover lift and the theme wave are evaluated
 * for every instance in a single `useFrame`, then written to `instanceMatrix`/`instanceColor`;
 * nothing here allocates a mesh or a tween per hexagon, and nothing renders once everything rests.
 *
 * Theme changes retarget from the colours currently on screen, so switching again mid-wave never
 * jumps; the canvas, geometry and scene stay mounted throughout.
 */
export function HexScene({
  dataset,
  displayMode,
  reducedMotion,
  started,
  inView,
  onFirstFrame,
  onEntranceSettled,
}: HexSceneProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const outlineRef = useRef<LineSegments>(null);
  const outlineMaterialRef = useRef<LineDashedMaterial>(null);
  const ambientRef = useRef<AmbientLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const keyRef = useRef<DirectionalLight>(null);
  const shadowRef = useRef<ShadowMaterial>(null);
  const contactRef = useRef<InstancedMesh>(null);
  const contactMaterialRef = useRef<MeshBasicMaterial>(null);
  const hovered = useRef(-1);
  const startTime = useRef<number | null>(null);
  const settled = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const firstFrameRef = useRef(onFirstFrame);
  const settledRef = useRef(onEntranceSettled);
  const inViewRef = useRef(inView);
  const reducedRef = useRef(reducedMotion);
  useLayoutEffect(() => {
    firstFrameRef.current = onFirstFrame;
    settledRef.current = onEntranceSettled;
    inViewRef.current = inView;
    reducedRef.current = reducedMotion;
  });

  const unit = dataset.hexSizeDeg;
  const radius = unit * HEX_FILL;
  const geometry = useMemo(() => createHexPrism(radius), [radius]);
  // Contact shadows: a soft footprint under every tile. Neighbouring footprints overlap in the gaps,
  // which darkens them a little: a cheap, restrained ambient occlusion that stays glued to the tiles.
  const contactGeometry = useMemo(() => {
    const plane = new PlaneGeometry(radius * 2.7, radius * 2.7);
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, [radius]);
  const contactTexture = useMemo(() => createSoftSpotTexture(), []);
  useEffect(
    () => () => {
      contactGeometry.dispose();
      contactTexture.dispose();
    },
    [contactGeometry, contactTexture],
  );
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  const { drawn, noData, schedule, wave } = useMemo(() => {
    const withData: DrawnCell[] = [];
    const without: HexCell[] = [];
    for (const cell of dataset.cells) {
      if (cell.hasData && cell.value !== null) {
        withData.push({ cell, height: tileHeight(cell.value, unit) });
      } else {
        without.push(cell);
      }
    }
    const xs = withData.map((item) => item.cell.x);
    return {
      drawn: withData,
      noData: without,
      schedule: buildEntranceSchedule(xs),
      wave: buildThemeWave(xs),
    };
  }, [dataset, unit]);
  const outline = useMemo(() => hexOutline(noData, radius, 0.02), [noData, radius]);
  // Dashes need cumulative edge lengths, which three.js computes from the attached positions.
  useLayoutEffect(() => {
    outlineRef.current?.computeLineDistances();
  }, [outline]);

  // Per-instance state: lift (hover) and the three colour buffers the theme wave moves between.
  const state = useRef({
    lifts: new Float32Array(0),
    from: new Float32Array(0),
    current: new Float32Array(0),
    to: new Float32Array(0),
    themeStart: null as number | null,
    mode: displayMode,
    rigFrom: lightRigFor(displayMode),
    rigTo: lightRigFor(displayMode),
    rig: lightRigFor(displayMode),
    fullWrite: true,
  });

  const dummy = useMemo(() => new Object3D(), []);
  const scratch = useMemo(() => new Color(), []);

  const applyRig = (rig: HexLightRig) => {
    const [ar, ag, ab] = rgbArray(rig.ambient);
    ambientRef.current?.color.setRGB(ar, ag, ab);
    if (ambientRef.current) ambientRef.current.intensity = rig.ambientIntensity;
    const hemi = hemiRef.current;
    if (hemi) {
      const [sr, sg, sb] = rgbArray(rig.hemiSky);
      const [gr, gg, gb] = rgbArray(rig.hemiGround);
      hemi.color.setRGB(sr, sg, sb);
      hemi.groundColor.setRGB(gr, gg, gb);
      hemi.intensity = rig.hemiIntensity;
    }
    const key = keyRef.current;
    if (key) {
      const [kr, kg, kb] = rgbArray(rig.key);
      key.color.setRGB(kr, kg, kb);
      key.intensity = rig.keyIntensity;
    }
    const contactMaterial = contactMaterialRef.current;
    if (contactMaterial) {
      const [r, g, b] = rgbArray(rig.shadow);
      contactMaterial.color.setRGB(r, g, b);
      contactMaterial.opacity = Math.min(1, rig.shadowOpacity * CONTACT_STRENGTH);
    }
    const shadow = shadowRef.current;
    if (shadow) {
      const [r, g, b] = rgbArray(rig.shadow);
      shadow.color.setRGB(r, g, b);
      shadow.opacity = rig.shadowOpacity;
    }
  };

  const fillTarget = (target: Float32Array, theme: HexTheme) => {
    drawn.forEach((item, index) => {
      const [r, g, b] = valueToRgb(item.cell.value ?? 0, theme);
      target[index * 3] = r / 255;
      target[index * 3 + 1] = g / 255;
      target[index * 3 + 2] = b / 255;
    });
  };

  // Buffers follow the data; the first colours are the current theme's, so nothing flashes.
  useLayoutEffect(() => {
    const s = state.current;
    s.lifts = new Float32Array(drawn.length);
    s.from = new Float32Array(drawn.length * 3);
    s.current = new Float32Array(drawn.length * 3);
    s.to = new Float32Array(drawn.length * 3);
    fillTarget(s.to, s.mode);
    s.current.set(s.to);
    s.from.set(s.to);
    s.themeStart = null;
    s.fullWrite = true;
    applyRig(s.rig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fillTarget/applyRig are stable closures over refs and memoised data
  }, [drawn]);

  // Theme change: retarget from whatever is on screen right now (safe mid-wave, mid-entrance).
  useEffect(() => {
    const s = state.current;
    if (s.mode === displayMode) return;
    s.mode = displayMode;
    s.rigFrom = s.rig;
    s.rigTo = lightRigFor(displayMode);
    s.from.set(s.current);
    fillTarget(s.to, displayMode);
    if (startTime.current !== null && inViewRef.current) {
      s.themeStart = performance.now() + THEME_START_DELAY_MS;
    } else {
      // Not started yet, or off screen: land on the new palette without playing the wave.
      s.current.set(s.to);
      s.from.set(s.to);
      s.rig = s.rigTo;
      s.themeStart = null;
      s.fullWrite = true;
      applyRig(s.rig);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fillTarget/applyRig are stable closures over refs and memoised data
  }, [displayMode, invalidate]);

  const writeInstance = (index: number, pose: CellPose, fx: ThemeFx) => {
    const mesh = meshRef.current;
    const item = drawn[index];
    if (!mesh || !item) return;
    const s = state.current;
    const lift = s.lifts[index] ?? 0;
    const shake = unit / ENTRANCE_TUNED_SIZE;
    const height = (item.height + lift * unit * HOVER_LIFT) * pose.scale;
    dummy.position.set(
      item.cell.x + pose.offsetX * shake,
      height / 2 + pose.offsetY * shake + fx.lift * unit * WAVE_LIFT,
      item.cell.z + pose.offsetZ * shake,
    );
    dummy.rotation.set(0, 0, -fx.tilt * WAVE_TILT);
    dummy.scale.set(Math.max(pose.scale, 1e-4), Math.max(height, 1e-4), Math.max(pose.scale, 1e-4));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);

    // The footprint stays on the surface (it neither rises with the wave nor tilts) and only
    // grows with the tile during the entrance, so the shadow is always attached to the tile.
    const contact = contactRef.current;
    if (contact) {
      dummy.position.set(item.cell.x + unit * 0.1, 0.004, item.cell.z + unit * 0.08);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(Math.max(pose.scale, 1e-4), 1, Math.max(pose.scale, 1e-4));
      dummy.updateMatrix();
      contact.setMatrixAt(index, dummy.matrix);
    }

    const o = index * 3;
    scratch.setRGB(
      (s.from[o] ?? 0) + ((s.to[o] ?? 0) - (s.from[o] ?? 0)) * fx.mix,
      (s.from[o + 1] ?? 0) + ((s.to[o + 1] ?? 0) - (s.from[o + 1] ?? 0)) * fx.mix,
      (s.from[o + 2] ?? 0) + ((s.to[o + 2] ?? 0) - (s.from[o + 2] ?? 0)) * fx.mix,
    );
    // Remember what is on screen, so a theme change in mid-wave starts from it.
    s.current[o] = scratch.r;
    s.current[o + 1] = scratch.g;
    s.current[o + 2] = scratch.b;
    scratch.multiplyScalar(1 + lift * HOVER_BRIGHTEN);
    scratch.lerp(WHITE, fx.glow * WAVE_GLOW);
    scratch.lerp(WHITE, (1 - pose.opacity) * BLINK_STRENGTH);
    mesh.setColorAt(index, scratch);
  };

  // Hidden until the entrance starts, so there is no flash of the finished map.
  useLayoutEffect(() => {
    if (startTime.current !== null) return;
    drawn.forEach((_, index) => {
      writeInstance(index, { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 0, opacity: 0 }, THEME_SETTLED);
    });
    const mesh = meshRef.current;
    if (mesh) {
      mesh.instanceMatrix.needsUpdate = true;
      if (contactRef.current) contactRef.current.instanceMatrix.needsUpdate = true;
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

  useFrame((frame) => {
    const mesh = meshRef.current;
    if (!mesh || startTime.current === null) return;
    const s = state.current;
    const now = performance.now();
    const reduced = reducedRef.current;

    const elapsed = now - startTime.current;
    const entranceTotal = reduced ? REDUCED_FADE_MS : ENTRANCE_TOTAL_MS;
    const entering = elapsed < entranceTotal;
    const finalisingEntrance = !entering && !settled.current;

    const themeTotal = themeTransitionDuration(reduced);
    const themeElapsed = s.themeStart === null ? null : now - s.themeStart;
    const themeActive = themeElapsed !== null && themeElapsed < themeTotal;
    const themeFinalising = themeElapsed !== null && !themeActive;
    const writeAll = s.fullWrite || entering || finalisingEntrance || themeActive || themeFinalising;

    let moving = entering || themeActive;
    for (let index = 0; index < drawn.length; index += 1) {
      const target = index === hovered.current ? 1 : 0;
      const lift = s.lifts[index] ?? 0;
      const liftChanging = Math.abs(target - lift) > LIFT_EPSILON;
      if (liftChanging) {
        s.lifts[index] = lift + (target - lift) * LIFT_EASE;
        moving = true;
      } else if (lift !== target) {
        s.lifts[index] = target;
      }
      if (!writeAll && !liftChanging && lift === target) continue;

      const entrance = schedule[index];
      const pose = !entering
        ? SETTLED_POSE
        : reduced || !entrance
          ? evaluateReducedEntrance(elapsed)
          : evaluateEntrance(entrance, elapsed);
      const fx =
        themeElapsed === null || themeFinalising
          ? THEME_SETTLED
          : evaluateThemeWave(wave[index] ?? 0, themeElapsed, reduced);
      writeInstance(index, pose, themeFinalising || themeElapsed === null ? { ...fx, mix: 1 } : fx);
    }
    s.fullWrite = false;
    mesh.instanceMatrix.needsUpdate = true;
    if (contactRef.current) contactRef.current.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Lights, shadow and outline follow one global progress; the tiles follow the wave.
    if (themeElapsed !== null) {
      const t = Math.min(1, Math.max(0, themeElapsed / themeTotal));
      const eased = t * t * (3 - 2 * t);
      s.rig = lerpLightRig(s.rigFrom, s.rigTo, eased);
      applyRig(s.rig);
    }
    if (themeFinalising) {
      // Everything lands exactly on the new palette: the from-buffer is now the to-buffer.
      s.from.set(s.to);
      s.current.set(s.to);
      s.themeStart = null;
      s.rig = s.rigTo;
      applyRig(s.rig);
    }

    const outlineMaterial = outlineMaterialRef.current;
    if (outlineMaterial) {
      const progress = reduced ? elapsed / REDUCED_FADE_MS : (elapsed - 300) / 700;
      const [r, g, b] = rgbArray(s.rig.outline);
      outlineMaterial.color.setRGB(r, g, b);
      outlineMaterial.opacity = s.rig.outlineOpacity * Math.min(1, Math.max(0, progress));
    }

    if (finalisingEntrance) {
      settled.current = true;
      settledRef.current();
    }
    if (moving) frame.invalidate();
  });

  // Development only: a checksum of what is on the GPU, so a script can prove that every theme
  // switch (rapid, mid-entrance, off screen) ends on the same instances as a fresh load.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as unknown as { __nmHexInstances?: () => unknown };
    target.__nmHexInstances = () => {
      const mesh = meshRef.current;
      const sum = (values: ArrayLike<number> | undefined) => {
        let total = 0;
        for (let index = 0; index < (values?.length ?? 0); index += 1)
          total += Math.round((values?.[index] ?? 0) * 1000);
        return total;
      };
      return {
        count: mesh?.count ?? 0,
        matrix: sum(mesh?.instanceMatrix.array),
        color: sum(mesh?.instanceColor?.array),
        finite: mesh ? Array.from(mesh.instanceMatrix.array).every(Number.isFinite) : false,
        themeRunning: state.current.themeStart !== null,
        mode: state.current.mode,
      };
    };
    return () => {
      delete target.__nmHexInstances;
    };
  }, []);

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
      <ambientLight ref={ambientRef} />
      <hemisphereLight ref={hemiRef} />
      <directionalLight
        ref={keyRef}
        position={[-20, 52, -26]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-radius={2.5}
        shadow-blurSamples={12}
        shadow-bias={-0.0004}
        shadow-normalBias={0.01}
      />
      <group position={[0, 0, 0]}>
        <instancedMesh
          ref={meshRef}
          args={[geometry, undefined, drawn.length]}
          castShadow
          receiveShadow
          onPointerMove={handleMove}
          onPointerOut={handleOut}
        >
          <meshStandardMaterial roughness={0.55} metalness={0} />
        </instancedMesh>
        <lineSegments ref={outlineRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[outline, 3]} />
          </bufferGeometry>
          <lineDashedMaterial
            ref={outlineMaterialRef}
            color="#ffffff"
            dashSize={unit * 0.28}
            gapSize={unit * 0.2}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </lineSegments>
      </group>
      {/* The surface the tiles rest on: tile bottoms and this plane are the same height. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[120, 80]} />
        <shadowMaterial ref={shadowRef} transparent opacity={0.17} />
      </mesh>
      <instancedMesh
        ref={contactRef}
        args={[contactGeometry, undefined, drawn.length]}
        renderOrder={-1}
        frustumCulled={false}
      >
        <meshBasicMaterial
          ref={contactMaterialRef}
          map={contactTexture}
          transparent
          depthWrite={false}
          opacity={0.3}
        />
      </instancedMesh>
    </>
  );
}
