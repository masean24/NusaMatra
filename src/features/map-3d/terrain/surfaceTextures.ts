import * as THREE from 'three';
import type { CoastPolygon } from './coastline';
import { createGrid, rasterizeLand, sampleField, type HeightField } from './heightField';
import { hash2D, smoothNoise, smoothstep } from './noise';

type Rgb = readonly [number, number, number];

/** Kapur & Kobalt land ramp, low to high (#FBFAF6 → #B8AF9A). */
const LAND_RAMP: readonly Rgb[] = [
  [251, 250, 246],
  [237, 233, 223],
  [217, 211, 195],
  [184, 175, 154],
];
/** Elevation fractions where each ramp colour is reached (after the first). */
const LAND_STOPS = [0.3, 0.62, 1] as const;

const SEA_DEEP: Rgb = [30, 63, 217]; // #1E3FD9
const SEA: Rgb = [47, 91, 255]; // #2F5BFF
const SEA_SHALLOW: Rgb = [92, 127, 255]; // #5C7FFF
const CHALK: Rgb = [251, 250, 246]; // #FBFAF6

const CONTOUR_COUNT = 14;
const GRATICULE_DEG = 5;

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function hypsometric(t: number): Rgb {
  let lower = 0;
  for (let i = 0; i < LAND_STOPS.length; i++) {
    const upper = LAND_STOPS[i] ?? 1;
    if (t <= upper || i === LAND_STOPS.length - 1) {
      const from = LAND_RAMP[i] ?? CHALK;
      const to = LAND_RAMP[i + 1] ?? from;
      return mix(from, to, Math.min(1, Math.max(0, (t - lower) / (upper - lower))));
    }
    lower = upper;
  }
  return CHALK;
}

/** RGBA8 pixels, row 0 = south, ready for a DataTexture. */
export interface PixelImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** Wraps pixels in a filtered, mipmapped sRGB texture. The pixel buffer is shared, not copied. */
export function imageToTexture({ data, width, height }: PixelImage): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function write(data: Uint8Array, offset: number, rgb: Rgb, alpha: number): void {
  data[offset] = Math.min(255, Math.max(0, rgb[0]));
  data[offset + 1] = Math.min(255, Math.max(0, rgb[1]));
  data[offset + 2] = Math.min(255, Math.max(0, rgb[2]));
  data[offset + 3] = alpha;
}

/**
 * Land colour over the height field's extent: hypsometric chalk ramp, contour lines, baked
 * hillshade and grain. Alpha is the coastline mask at texture resolution, so an alpha-tested
 * material draws the shore far crisper than the terrain mesh's vertex spacing.
 */
export function createLandImage(
  polygons: readonly CoastPolygon[],
  field: HeightField,
  width: number,
): PixelImage {
  const { bounds } = field.grid;
  const grid = createGrid(bounds, (bounds.maxLon - bounds.minLon) / (width - 1));
  const mask = rasterizeLand(polygons, grid);
  const data = new Uint8Array(grid.cols * grid.rows * 4);
  const contourStep = field.maxRelief / CONTOUR_COUNT;

  for (let row = 0; row < grid.rows; row++) {
    const lat = bounds.minLat + row * grid.step;
    for (let col = 0; col < grid.cols; col++) {
      const i = row * grid.cols + col;
      if (mask[i] !== 1) {
        // Transparent, but chalk-coloured so linear filtering leaves no dark fringe on the shore.
        write(data, i * 4, CHALK, 0);
        continue;
      }
      const lon = bounds.minLon + col * grid.step;
      const height = sampleField(field.heights, field.grid, lon, lat);
      const shade = sampleField(field.shade, field.grid, lon, lat);
      const band = (height / contourStep) % 1;
      const contour = height > contourStep * 0.5 && band < 0.075 ? 0.93 : 1;
      const light = (0.9 + 0.2 * shade) * contour;
      const grain = (hash2D(col, row) - 0.5) * 6;
      const [r, g, b] = hypsometric(height / field.maxRelief);
      write(data, i * 4, [r * light + grain, g * light + grain, b * light + grain], 255);
    }
  }
  return { data, width: grid.cols, height: grid.rows };
}

/**
 * Sea colour over the height field's extent: pale shelf along every coast, cobalt open water,
 * deeper cobalt far offshore, and a faint 5° graticule with a brighter equator.
 */
export function createOceanImage(field: HeightField, width: number): PixelImage {
  const { bounds } = field.grid;
  const grid = createGrid(bounds, (bounds.maxLon - bounds.minLon) / (width - 1));
  const data = new Uint8Array(grid.cols * grid.rows * 4);
  const lineHalfWidth = grid.step * 0.55;

  for (let row = 0; row < grid.rows; row++) {
    const lat = bounds.minLat + row * grid.step;
    const onParallel = Math.abs(lat - Math.round(lat / GRATICULE_DEG) * GRATICULE_DEG) < lineHalfWidth;
    const onEquator = Math.abs(lat) < lineHalfWidth;
    for (let col = 0; col < grid.cols; col++) {
      const lon = bounds.minLon + col * grid.step;
      const distance = sampleField(field.seaDistance, field.grid, lon, lat);
      const shelf = 1 - smoothstep(0, 0.7, distance);
      const deep = smoothstep(2.5, 7, distance);
      let rgb = mix(mix(SEA, SEA_SHALLOW, shelf), SEA_DEEP, deep * 0.55);
      // A thin chalk wash right at the shore reads as surf and lifts the coast off the sea.
      rgb = mix(rgb, CHALK, (1 - smoothstep(0, 0.12, distance)) * 0.35);
      const swell = (smoothNoise(lon * 0.7, lat * 0.7) - 0.5) * 0.08;
      rgb = mix(rgb, swell > 0 ? SEA_SHALLOW : SEA_DEEP, Math.abs(swell));
      const onMeridian = Math.abs(lon - Math.round(lon / GRATICULE_DEG) * GRATICULE_DEG) < lineHalfWidth;
      if (onEquator) rgb = mix(rgb, CHALK, 0.22);
      else if (onParallel || onMeridian) rgb = mix(rgb, CHALK, 0.09);
      write(data, (row * grid.cols + col) * 4, rgb, 255);
    }
  }
  return { data, width: grid.cols, height: grid.rows };
}
