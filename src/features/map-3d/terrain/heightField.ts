import type { CoastPolygon, GeoBounds } from './coastline';
import { fbmNoise, ridgedNoise, smoothstep } from './noise';

/**
 * Regular lon/lat lattice. Node (col, row) sits at
 * lon = bounds.minLon + col * step, lat = bounds.minLat + row * step (row 0 = south).
 */
export interface GeoGrid {
  readonly bounds: GeoBounds;
  readonly step: number;
  readonly cols: number;
  readonly rows: number;
}

export function createGrid(bounds: GeoBounds, step: number): GeoGrid {
  const cols = Math.floor((bounds.maxLon - bounds.minLon) / step) + 1;
  const rows = Math.floor((bounds.maxLat - bounds.minLat) / step) + 1;
  return {
    bounds: {
      minLon: bounds.minLon,
      minLat: bounds.minLat,
      maxLon: bounds.minLon + (cols - 1) * step,
      maxLat: bounds.minLat + (rows - 1) * step,
    },
    step,
    cols,
    rows,
  };
}

export function expandBounds(bounds: GeoBounds, marginDeg: number): GeoBounds {
  return {
    minLon: bounds.minLon - marginDeg,
    maxLon: bounds.maxLon + marginDeg,
    minLat: bounds.minLat - marginDeg,
    maxLat: bounds.maxLat + marginDeg,
  };
}

/**
 * Even-odd scanline fill of every ring at once: 1 where the node lies on land. Holes and
 * separate islands need no special casing under the even-odd rule.
 */
export function rasterizeLand(polygons: readonly CoastPolygon[], grid: GeoGrid): Uint8Array {
  const { cols, rows, step, bounds } = grid;
  const mask = new Uint8Array(cols * rows);
  const crossings: number[] = [];

  for (let row = 0; row < rows; row++) {
    const lat = bounds.minLat + row * step;
    crossings.length = 0;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i];
          const b = ring[j];
          if (!a || !b || a[1] > lat === b[1] > lat) continue;
          crossings.push(a[0] + ((lat - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
    }
    crossings.sort((x, y) => x - y);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(((crossings[k] ?? 0) - bounds.minLon) / step));
      const to = Math.min(cols - 1, Math.floor(((crossings[k + 1] ?? 0) - bounds.minLon) / step));
      for (let col = from; col <= to; col++) mask[row * cols + col] = 1;
    }
  }
  return mask;
}

/**
 * Two-pass chamfer distance (1, √2), in grid steps, from every node whose mask equals
 * `from` to the nearest node whose mask differs. Nodes of the other class get 0.
 */
export function distanceTransform(mask: Uint8Array, cols: number, rows: number, from: 0 | 1): Float32Array {
  const far = cols + rows;
  const dist = new Float32Array(cols * rows);
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] === from ? far : 0;
  const diagonal = Math.SQRT2;
  const at = (c: number, r: number) => dist[r * cols + c] ?? far;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let d = dist[i] ?? 0;
      if (d === 0) continue;
      if (c > 0) d = Math.min(d, at(c - 1, r) + 1);
      if (r > 0) {
        d = Math.min(d, at(c, r - 1) + 1);
        if (c > 0) d = Math.min(d, at(c - 1, r - 1) + diagonal);
        if (c < cols - 1) d = Math.min(d, at(c + 1, r - 1) + diagonal);
      }
      dist[i] = d;
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      let d = dist[i] ?? 0;
      if (d === 0) continue;
      if (c < cols - 1) d = Math.min(d, at(c + 1, r) + 1);
      if (r < rows - 1) {
        d = Math.min(d, at(c, r + 1) + 1);
        if (c < cols - 1) d = Math.min(d, at(c + 1, r + 1) + diagonal);
        if (c > 0) d = Math.min(d, at(c - 1, r + 1) + diagonal);
      }
      dist[i] = d;
    }
  }
  return dist;
}

export interface ReliefOptions {
  /** Height of the highest illustrative peak, in world units (1 unit = 1° of latitude). */
  readonly maxRelief: number;
  /** Distance inland over which land rises from the shore, in degrees. */
  readonly coastRampDeg: number;
}

export interface HeightField {
  readonly grid: GeoGrid;
  readonly land: Uint8Array;
  /** Illustrative elevation above the shore, world units; 0 on water. */
  readonly heights: Float32Array;
  /** Distance from water to the nearest land, degrees; 0 on land. */
  readonly seaDistance: Float32Array;
  /** Lambert term of the relief under the map's key light, [0, 1]; 0.5 on flat ground. */
  readonly shade: Float32Array;
  readonly maxRelief: number;
}

/**
 * ILLUSTRATIVE relief, not a DEM: elevation rises with distance from the coast and is shaped
 * by ridged noise. Large islands get high interiors, small islands stay low — plausible, but
 * no peak sits where a real one does.
 */
export function buildHeightField(
  polygons: readonly CoastPolygon[],
  grid: GeoGrid,
  options: ReliefOptions,
): HeightField {
  const { cols, rows, step, bounds } = grid;
  const land = rasterizeLand(polygons, grid);
  const inland = distanceTransform(land, cols, rows, 1);
  const seaward = distanceTransform(land, cols, rows, 0);
  const heights = new Float32Array(cols * rows);
  const seaDistance = new Float32Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    const lat = bounds.minLat + row * step;
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      seaDistance[i] = (seaward[i] ?? 0) * step;
      if (land[i] !== 1) continue;
      const lon = bounds.minLon + col * step;
      const ramp = smoothstep(0, options.coastRampDeg, (inland[i] ?? 0) * step);
      const massif = fbmNoise(lon * 0.35 + 3.1, lat * 0.35 - 7.4, 3);
      const ridges = ridgedNoise(lon * 0.95 + 11.3, lat * 0.95 + 2.9, 4);
      const grain = fbmNoise(lon * 5.0, lat * 5.0, 2);
      const elevation =
        Math.pow(ramp, 0.85) * (0.12 + 0.88 * (0.5 * massif + 0.5 * ridges)) + 0.025 * grain * ramp;
      heights[i] = Math.min(1, elevation) * options.maxRelief;
    }
  }

  return {
    grid,
    land,
    heights,
    seaDistance,
    shade: computeShade(heights, land, grid),
    maxRelief: options.maxRelief,
  };
}

/**
 * Direction towards the key light: upper left and slightly towards the viewer, so the slopes
 * facing the hero camera are lit and shadows fall away to the east. The hero's directional
 * light uses the same vector, so baked and real-time shading agree.
 */
export const HERO_SUN_DIRECTION = normalize3(-0.6, 0.72, 0.32);
const LIGHT = HERO_SUN_DIRECTION;

function normalize3(x: number, y: number, z: number): readonly [number, number, number] {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function computeShade(heights: Float32Array, land: Uint8Array, grid: GeoGrid): Float32Array {
  const { cols, rows, step } = grid;
  const shade = new Float32Array(cols * rows).fill(0.5);
  const h = (c: number, r: number) =>
    heights[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))] ?? 0;
  const [lx, ly, lz] = LIGHT;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (land[r * cols + c] !== 1) continue;
      // Surface normal of y = h(x, z), with x east and z south (the scene's axes).
      const nx = -(h(c + 1, r) - h(c - 1, r)) / (2 * step);
      const nz = (h(c, r + 1) - h(c, r - 1)) / (2 * step);
      const lambert = (nx * lx + ly + nz * lz) / Math.hypot(nx, 1, nz);
      shade[r * cols + c] = Math.max(0, lambert) / (2 * ly);
    }
  }
  return shade;
}

/** Bilinear sample of a node field at an arbitrary lon/lat; clamps outside the grid. */
export function sampleField(field: Float32Array, grid: GeoGrid, lon: number, lat: number): number {
  const { cols, rows, step, bounds } = grid;
  const x = Math.min(cols - 1, Math.max(0, (lon - bounds.minLon) / step));
  const y = Math.min(rows - 1, Math.max(0, (lat - bounds.minLat) / step));
  const c0 = Math.floor(x);
  const r0 = Math.floor(y);
  const c1 = Math.min(cols - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const fx = x - c0;
  const fy = y - r0;
  const top = (field[r0 * cols + c0] ?? 0) * (1 - fx) + (field[r0 * cols + c1] ?? 0) * fx;
  const bottom = (field[r1 * cols + c0] ?? 0) * (1 - fx) + (field[r1 * cols + c1] ?? 0) * fx;
  return top * (1 - fy) + bottom * fy;
}
