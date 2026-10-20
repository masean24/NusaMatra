import * as THREE from 'three';
import { coastlineBounds, type CoastlineDataset } from './coastline';
import { buildHeightField, createGrid, expandBounds, sampleField, type HeightField } from './heightField';
import { createLandImage, createOceanImage, imageToTexture, type PixelImage } from './surfaceTextures';

/** Projects WGS84 degrees to scene space (x east, z south, y up). */
export type Projector = (lon: number, lat: number, elevation?: number) => THREE.Vector3;

export interface HeroTerrainOptions {
  readonly project: Projector;
  /** Tileable micro-relief map; cloned so this terrain owns its own repeat. */
  readonly reliefBumpMap: THREE.Texture;
  /** Animated wave map shared with the engine's render loop. */
  readonly oceanBumpMap: THREE.Texture;
}

export interface HeroTerrain {
  /** Coastal plinth plus relief surface. */
  readonly land: THREE.Group;
  readonly ocean: THREE.Mesh;
  readonly oceanMaterial: THREE.MeshStandardMaterial;
  /** World-space box around the land, relief included (shadow camera extent). */
  readonly landBounds: THREE.Box3;
  /** Coastline vertices at shore and mid-relief height: what the camera must keep in frame. */
  readonly framingPoints: readonly THREE.Vector3[];
  /** World height of the land surface at a lon/lat (the shore height on water). */
  readonly surfaceHeightAt: (lon: number, lat: number) => number;
  readonly dispose: () => void;
}

const GRID_STEP_DEG = 0.07;
const GRID_MARGIN_DEG = 3;
const LAND_TEXTURE_WIDTH = 1536;
const OCEAN_TEXTURE_WIDTH = 768;
/** Vertical exaggeration ≈ 20× for Indonesia's ~4.8 km peaks; illustrative, see heightField. */
const MAX_RELIEF = 0.7;
const COAST_RAMP_DEG = 0.9;
/** Coastal plinth: rises from below the waterline to the shore, giving bevelled cliffs. */
const PLINTH_BOTTOM = -0.06;
const PLINTH_DEPTH = 0.1;
const PLINTH_BEVEL = 0.022;
const SHORE_HEIGHT = PLINTH_BOTTOM + PLINTH_DEPTH + PLINTH_BEVEL + 0.004;
/** Open water beyond the textured extent, so parallax never reveals an edge. */
const OCEAN_OVERSCAN = 160;

const CHALK = '#FBFAF6';
const LIMESTONE_CLIFF = '#B8AF9A';

/** Typed arrays of one geometry, reusable across mounts: GPU buffers are per mount, data is not. */
interface GeometryData {
  readonly attributes: Readonly<Record<string, THREE.BufferAttribute>>;
  readonly index: THREE.BufferAttribute | null;
  readonly groups: readonly { start: number; count: number; materialIndex?: number | undefined }[];
}

/** Everything expensive and deterministic about the terrain, computed once per dataset. */
interface TerrainData {
  readonly field: HeightField;
  readonly landImage: PixelImage;
  readonly oceanImage: PixelImage;
  readonly surface: GeometryData;
  readonly plinth: GeometryData;
  readonly ocean: GeometryData;
  readonly framingPoints: readonly THREE.Vector3[];
}

const terrainCache = new WeakMap<Projector, WeakMap<CoastlineDataset, TerrainData>>();

function getTerrainData(dataset: CoastlineDataset, project: Projector): TerrainData {
  let byDataset = terrainCache.get(project);
  if (!byDataset) {
    byDataset = new WeakMap();
    terrainCache.set(project, byDataset);
  }
  let data = byDataset.get(dataset);
  if (!data) {
    data = computeTerrainData(dataset, project);
    byDataset.set(dataset, data);
  }
  return data;
}

function computeTerrainData(dataset: CoastlineDataset, project: Projector): TerrainData {
  const grid = createGrid(expandBounds(coastlineBounds(dataset.polygons), GRID_MARGIN_DEG), GRID_STEP_DEG);
  const field = buildHeightField(dataset.polygons, grid, {
    maxRelief: MAX_RELIEF,
    coastRampDeg: COAST_RAMP_DEG,
  });
  return {
    field,
    landImage: createLandImage(dataset.polygons, field, LAND_TEXTURE_WIDTH),
    oceanImage: createOceanImage(field, OCEAN_TEXTURE_WIDTH),
    surface: toGeometryData(buildSurfaceGeometry(field, project)),
    plinth: toGeometryData(buildPlinthGeometry(dataset, project)),
    ocean: toGeometryData(buildOceanGeometry(field, project)),
    framingPoints: framingHull(dataset, project),
  };
}

/**
 * Convex hull of every coastline vertex, at shore and mid-relief height. A perspective view
 * maps a plane to a plane and keeps convexity, so keeping the hull in frame keeps every island
 * in frame — at a few dozen points instead of thousands per framing pass.
 */
function framingHull(dataset: CoastlineDataset, project: Projector): THREE.Vector3[] {
  const points = dataset.polygons
    .flatMap((polygon) => polygon[0] ?? [])
    .map(([lon, lat]) => project(lon, lat, 0))
    .sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const chain = (input: THREE.Vector3[]): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [];
    for (const p of input) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2] as THREE.Vector3, out[out.length - 1] as THREE.Vector3, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...chain(points), ...chain([...points].reverse())];
  return hull.flatMap((p) => [
    new THREE.Vector3(p.x, SHORE_HEIGHT, p.z),
    new THREE.Vector3(p.x, SHORE_HEIGHT + MAX_RELIEF * 0.6, p.z),
  ]);
}

function toGeometryData(geometry: THREE.BufferGeometry): GeometryData {
  const attributes: Record<string, THREE.BufferAttribute> = {};
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (attribute instanceof THREE.BufferAttribute) attributes[name] = attribute;
  }
  return { attributes, index: geometry.index, groups: geometry.groups.map((g) => ({ ...g })) };
}

function fromGeometryData(data: GeometryData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(data.attributes)) geometry.setAttribute(name, attribute);
  if (data.index) geometry.setIndex(data.index);
  for (const { start, count, materialIndex } of data.groups) geometry.addGroup(start, count, materialIndex);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds the hero's archipelago from a coastline dataset: an alpha-tested relief mesh over an
 * extruded, bevelled plinth, on a textured sea. No renderer and no DOM, so it is testable and
 * the engine owns lifecycle and animation. The first build per dataset costs a few hundred
 * milliseconds; later builds (route round-trips, React StrictMode) reuse the computed data.
 */
export function buildHeroTerrain(dataset: CoastlineDataset, options: HeroTerrainOptions): HeroTerrain {
  const data = getTerrainData(dataset, options.project);

  const landTexture = imageToTexture(data.landImage);
  const oceanTexture = imageToTexture(data.oceanImage);
  const reliefBump = options.reliefBumpMap.clone();
  reliefBump.repeat.set(26, 11);
  reliefBump.wrapS = THREE.RepeatWrapping;
  reliefBump.wrapT = THREE.RepeatWrapping;
  reliefBump.needsUpdate = true;

  const surfaceMaterial = new THREE.MeshStandardMaterial({
    map: landTexture,
    alphaTest: 0.5,
    bumpMap: reliefBump,
    bumpScale: 0.35,
    roughness: 0.93,
    metalness: 0,
  });
  const surface = new THREE.Mesh(fromGeometryData(data.surface), surfaceMaterial);
  // Alpha-tested shadows: without this the clipped-away sea quads would cast shadows too.
  const surfaceDepth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: landTexture,
    alphaTest: 0.5,
  });
  surface.customDepthMaterial = surfaceDepth;
  surface.castShadow = true;
  surface.receiveShadow = true;

  const capMaterial = new THREE.MeshStandardMaterial({ color: CHALK, roughness: 0.95, metalness: 0 });
  const cliffMaterial = new THREE.MeshStandardMaterial({
    color: LIMESTONE_CLIFF,
    roughness: 0.96,
    metalness: 0,
    bumpMap: reliefBump,
    bumpScale: 0.6,
  });
  const plinth = new THREE.Mesh(fromGeometryData(data.plinth), [capMaterial, cliffMaterial]);
  plinth.position.y = PLINTH_BOTTOM;
  plinth.castShadow = true;
  plinth.receiveShadow = true;

  const land = new THREE.Group();
  land.name = 'hero-land';
  land.add(plinth, surface);
  land.updateMatrixWorld(true);
  const landBounds = new THREE.Box3().setFromObject(plinth).union(new THREE.Box3().setFromObject(surface));

  const oceanMaterial = new THREE.MeshStandardMaterial({
    map: oceanTexture,
    bumpMap: options.oceanBumpMap,
    bumpScale: 0.03,
    roughness: 0.55,
    metalness: 0.08,
  });
  const ocean = new THREE.Mesh(fromGeometryData(data.ocean), oceanMaterial);
  ocean.name = 'hero-ocean';
  ocean.receiveShadow = true;

  return {
    land,
    ocean,
    oceanMaterial,
    landBounds,
    framingPoints: data.framingPoints,
    surfaceHeightAt: (lon, lat) => SHORE_HEIGHT + sampleField(data.field.heights, data.field.grid, lon, lat),
    dispose: () => {
      for (const mesh of [surface, plinth, ocean]) mesh.geometry.dispose();
      for (const material of [surfaceMaterial, surfaceDepth, capMaterial, cliffMaterial, oceanMaterial]) {
        material.dispose();
      }
      for (const texture of [landTexture, oceanTexture, reliefBump]) texture.dispose();
    },
  };
}

/**
 * Relief surface: one vertex per grid node near land, displaced by the height field. Quads
 * far out at sea are skipped, so the mesh costs vertices only where there is land to draw.
 */
function buildSurfaceGeometry(field: HeightField, project: Projector): THREE.BufferGeometry {
  const { cols, rows, step, bounds } = field.grid;
  const lonSpan = bounds.maxLon - bounds.minLon;
  const latSpan = bounds.maxLat - bounds.minLat;
  const nearLand = dilate(field.land, cols, rows);
  const vertexIndex = new Int32Array(cols * rows).fill(-1);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const vertex = (col: number, row: number): number => {
    const node = row * cols + col;
    const existing = vertexIndex[node] ?? -1;
    if (existing >= 0) return existing;
    const lon = bounds.minLon + col * step;
    const lat = bounds.minLat + row * step;
    const p = project(lon, lat, SHORE_HEIGHT + (field.heights[node] ?? 0));
    positions.push(p.x, p.y, p.z);
    uvs.push((lon - bounds.minLon) / lonSpan, (lat - bounds.minLat) / latSpan);
    const index = positions.length / 3 - 1;
    vertexIndex[node] = index;
    return index;
  };

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (nearLand[row * cols + col] !== 1) continue;
      const sw = vertex(col, row);
      const se = vertex(col + 1, row);
      const nw = vertex(col, row + 1);
      const ne = vertex(col + 1, row + 1);
      // Counter-clockwise seen from above (+y), with z pointing south.
      indices.push(sw, se, nw, se, ne, nw);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Marks a cell when it or any of its 8 neighbours is land: the surface must overlap the shore. */
function dilate(mask: Uint8Array, cols: number, rows: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r * cols + c] !== 1) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out[rr * cols + cc] = 1;
        }
      }
    }
  }
  return out;
}

/** Extruded island outlines with a bevelled top edge: the limestone cliffs at the shore. */
function buildPlinthGeometry(dataset: CoastlineDataset, project: Projector): THREE.BufferGeometry {
  const toShapePoint = ([lon, lat]: readonly [number, number]) => {
    const p = project(lon, lat, 0);
    // Shape space is (x, -z); rotateX(-90°) below turns it back into (x, z).
    return new THREE.Vector2(p.x, -p.z);
  };
  const shapes = dataset.polygons.map((polygon) => {
    const [outer = [], ...holes] = polygon;
    const shape = new THREE.Shape(outer.map(toShapePoint));
    shape.holes = holes.map((hole) => new THREE.Path(hole.map(toShapePoint)));
    return shape;
  });
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: PLINTH_DEPTH,
    bevelEnabled: true,
    bevelThickness: PLINTH_BEVEL,
    bevelSize: PLINTH_BEVEL * 0.8,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** One quad of sea; UVs map the textured extent and clamp to open water beyond it. */
function buildOceanGeometry(field: HeightField, project: Projector): THREE.BufferGeometry {
  const { bounds } = field.grid;
  const sw = project(bounds.minLon, bounds.minLat);
  const ne = project(bounds.maxLon, bounds.maxLat);
  const width = ne.x - sw.x;
  const depth = sw.z - ne.z;
  const geometry = new THREE.PlaneGeometry(width + 2 * OCEAN_OVERSCAN, depth + 2 * OCEAN_OVERSCAN);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((sw.x + ne.x) / 2, 0, (sw.z + ne.z) / 2);

  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) - sw.x) / width, (sw.z - position.getZ(i)) / depth);
  }
  uv.needsUpdate = true;
  return geometry;
}
