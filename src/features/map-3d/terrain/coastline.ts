import rawCoastline from '../data/indonesia-coastline.json';

/** [longitude, latitude] in WGS84 degrees. */
export type LonLat = readonly [number, number];
/** Closed ring: the first and last positions are equal. */
export type CoastRing = readonly LonLat[];
/** Outer ring first (counter-clockwise), then holes. */
export type CoastPolygon = readonly CoastRing[];

export interface CoastlineMetadata {
  readonly datasetId: string;
  readonly version: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly processing: string;
  readonly purpose: string;
}

export interface CoastlineDataset {
  readonly metadata: CoastlineMetadata;
  readonly polygons: readonly CoastPolygon[];
}

export interface GeoBounds {
  readonly minLon: number;
  readonly maxLon: number;
  readonly minLat: number;
  readonly maxLat: number;
}

/** Generous envelope around the Indonesian archipelago; anything outside is a data error. */
const PLAUSIBLE_BOUNDS: GeoBounds = { minLon: 90, maxLon: 145, minLat: -15, maxLat: 10 };

const METADATA_KEYS = [
  'datasetId',
  'version',
  'source',
  'sourceUrl',
  'license',
  'processing',
  'purpose',
] as const satisfies readonly (keyof CoastlineMetadata)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(reason: string): never {
  throw new Error(`Dataset garis pantai tidak valid: ${reason}`);
}

function parsePosition(value: unknown): LonLat {
  if (!Array.isArray(value) || value.length < 2) fail('posisi bukan pasangan [lon, lat]');
  const [lon, lat] = value as unknown[];
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    fail('koordinat bukan angka');
  }
  if (
    lon < PLAUSIBLE_BOUNDS.minLon ||
    lon > PLAUSIBLE_BOUNDS.maxLon ||
    lat < PLAUSIBLE_BOUNDS.minLat ||
    lat > PLAUSIBLE_BOUNDS.maxLat
  ) {
    fail(`koordinat ${String(lon)}, ${String(lat)} di luar wilayah Indonesia`);
  }
  return [lon, lat];
}

function parseRing(value: unknown): CoastRing {
  if (!Array.isArray(value) || value.length < 4) fail('cincin poligon kurang dari 4 posisi');
  const ring = value.map(parsePosition);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) fail('cincin poligon tidak tertutup');
  return ring;
}

/** Runtime validation at the data boundary: the JSON file's TypeScript type proves nothing. */
export function parseCoastlineDataset(raw: unknown): CoastlineDataset {
  if (!isRecord(raw) || raw.type !== 'FeatureCollection') fail('bukan FeatureCollection');
  const { metadata, features } = raw;
  if (!isRecord(metadata)) fail('metadata tidak ada');
  for (const key of METADATA_KEYS) {
    if (typeof metadata[key] !== 'string' || metadata[key] === '') fail(`metadata.${key} kosong`);
  }
  if (!Array.isArray(features) || features.length === 0) fail('tidak ada fitur');

  const polygons: CoastPolygon[] = [];
  for (const feature of features as unknown[]) {
    const geometry = isRecord(feature) ? feature.geometry : undefined;
    if (!isRecord(geometry)) fail('fitur tanpa geometri');
    if (geometry.type === 'Polygon') {
      polygons.push(parsePolygon(geometry.coordinates));
    } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      for (const polygon of geometry.coordinates as unknown[]) polygons.push(parsePolygon(polygon));
    } else {
      fail('geometri harus Polygon atau MultiPolygon');
    }
  }

  return {
    metadata: Object.fromEntries(
      METADATA_KEYS.map((key) => [key, metadata[key]]),
    ) as unknown as CoastlineMetadata,
    polygons,
  };
}

function parsePolygon(value: unknown): CoastPolygon {
  if (!Array.isArray(value) || value.length === 0) fail('poligon tanpa cincin');
  return value.map(parseRing);
}

export function coastlineBounds(polygons: readonly CoastPolygon[]): GeoBounds {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const polygon of polygons) {
    for (const [lon, lat] of polygon[0] ?? []) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

let indonesiaCoastline: CoastlineDataset | null = null;

/**
 * Natural Earth 1:10m coastline of Indonesia, bundled locally (see data/README.md). Parsed on
 * first use, so a data error surfaces where the hero handles errors instead of at import time.
 */
export function getIndonesiaCoastline(): CoastlineDataset {
  indonesiaCoastline ??= parseCoastlineDataset(rawCoastline);
  return indonesiaCoastline;
}
