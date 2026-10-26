import { projectToHeroFrame } from '@/lib/heroMapCamera';
import { valueToRgb, type HexTheme, type Rgb } from './hexColors';
import type { HexCell, HexDataset } from './hexDataset';
import { HEX_FILL, tileHeight } from './hexStyle';

/** The poster is drawn in the hero zone's own 720 × 660 design units. */
export const POSTER_WIDTH = 720;
export const POSTER_HEIGHT = 660;

export interface PosterShape {
  readonly key: string;
  readonly points: string;
  readonly fill: string;
}

export interface HexPosterPicture {
  readonly shadows: readonly PosterShape[];
  readonly tiles: readonly PosterShape[];
  /** Dashed outlines of the "no data" cells. */
  readonly outlines: readonly PosterShape[];
}

type Corner = readonly [number, number];

/** The six corners of a pointy-top hexagon (a vertex points along +z, towards the viewer). */
function corners(cell: HexCell, radius: number): Corner[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index;
    return [cell.x + radius * Math.sin(angle), cell.z + radius * Math.cos(angle)] as const;
  });
}

function project(x: number, y: number, z: number): string {
  const { u, v } = projectToHeroFrame([x, y, z]);
  return `${(u * POSTER_WIDTH).toFixed(1)},${(v * POSTER_HEIGHT).toFixed(1)}`;
}

function polygon(ring: readonly Corner[], y: number): string {
  return ring.map(([x, z]) => project(x, y, z)).join(' ');
}

/** A little white mixed in on top faces so the flat poster matches the softly lit scene it stands in for. */
const TOP_LIFT = 0.1;
const shade = (rgb: Rgb, factor: number, lift = 0) =>
  `rgb(${rgb.map((channel) => String(Math.round((channel * (1 - lift) + 255 * lift) * factor))).join(',')})`;

/** Warm Normal shadow, cobalt Kaca shadow (the same hues as the live scene's ground shadow). */
const SHADOW: Record<HexTheme, string> = { normal: 'rgb(70,52,36)', glass: 'rgb(12,28,110)' };

/**
 * A flat picture of the same map the 3D scene draws, from the same camera, grid, heights and
 * palette: tiles seen from the front and above with their two lit sides, and a compact soft shadow
 * at their feet. It stands in for the scene while that loads or if WebGL is unavailable, so there
 * is never another illustration (or an empty box) in its place.
 */
export function buildHexPoster(dataset: HexDataset, theme: HexTheme): HexPosterPicture {
  const radius = dataset.hexSizeDeg * HEX_FILL;
  const withData = dataset.cells.filter((cell) => cell.hasData && cell.value !== null);
  // Back to front, so nearer tiles cover the sides of the ones behind them.
  const ordered = [...withData].sort((a, b) => a.z - b.z || a.x - b.x);

  const shadows: PosterShape[] = ordered.map((cell) => {
    const base = corners(cell, radius * 1.06).map(
      ([x, z]) => [x + radius * 0.22, z + radius * 0.16] as const,
    );
    return { key: `s-${cell.id}`, points: polygon(base, 0), fill: SHADOW[theme] };
  });

  const tiles: PosterShape[] = ordered.flatMap((cell) => {
    const value = cell.value ?? 0;
    const color = valueToRgb(value, theme);
    const height = tileHeight(value, dataset.hexSizeDeg);
    const ring = corners(cell, radius);
    const [c0, c1, , , , c5] = ring;
    if (!c0 || !c1 || !c5) return [];
    // The two faces turned towards the viewer: right-front (corner 0–1) and left-front (5–0).
    const rightFace: Corner[] = [c0, c1];
    const leftFace: Corner[] = [c5, c0];
    const side = (edge: Corner[], factor: number, name: string): PosterShape => {
      const [from, to] = edge;
      if (!from || !to) throw new Error('side face needs two corners');
      const points = [
        project(from[0], height, from[1]),
        project(to[0], height, to[1]),
        project(to[0], 0, to[1]),
        project(from[0], 0, from[1]),
      ].join(' ');
      return { key: `${name}-${cell.id}`, points, fill: shade(color, factor) };
    };
    return [
      side(leftFace, 0.9, 'l'),
      side(rightFace, 0.78, 'r'),
      { key: `t-${cell.id}`, points: polygon(ring, height), fill: shade(color, 1, TOP_LIFT) },
    ];
  });

  const outlines: PosterShape[] = dataset.cells
    .filter((cell) => !cell.hasData)
    .map((cell) => ({ key: `o-${cell.id}`, points: polygon(corners(cell, radius), 0.02), fill: 'none' }));

  return { shadows, tiles, outlines };
}
