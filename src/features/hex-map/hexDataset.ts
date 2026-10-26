/**
 * The hexagon grid behind the landing hero map (`public/data/hex-indonesia.json`, built by
 * `npm run build:hex`). The land shape comes from Natural Earth; the per-cell `value` is SIMULATED
 * and must stay labelled as such wherever it is drawn.
 */
export interface HexCell {
  readonly id: string;
  /** Planar position in degrees from the dataset origin: x grows east, z grows south. */
  readonly x: number;
  readonly z: number;
  readonly lon: number;
  readonly lat: number;
  /** Simulated 0–1 value; `null` means "no data" (never silently 0). */
  readonly value: number | null;
  readonly hasData: boolean;
}

export interface HexDataset {
  readonly hexSizeDeg: number;
  readonly origin: { readonly lon: number; readonly lat: number };
  readonly cells: readonly HexCell[];
}

function fail(reason: string): never {
  throw new Error(`Dataset hexagon tidak valid: ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label} bukan angka`);
  return value;
}

/** One row of `cells`: [x, z, lon, lat, value], with `value` null for "no data". */
function parseCell(raw: unknown, index: number): HexCell {
  if (!Array.isArray(raw) || raw.length !== 5) {
    fail(`sel ${String(index)} bukan baris [x, z, lon, lat, nilai]`);
  }
  const [x, z, lon, lat, value] = raw as unknown[];
  const id = `h${String(index)}`;
  if (value !== null) {
    const numeric = finiteNumber(value, `nilai sel ${id}`);
    if (numeric < 0 || numeric > 1) fail(`nilai sel ${id} di luar 0–1`);
  }
  return {
    id,
    x: finiteNumber(x, `x sel ${id}`),
    z: finiteNumber(z, `z sel ${id}`),
    lon: finiteNumber(lon, `lon sel ${id}`),
    lat: finiteNumber(lat, `lat sel ${id}`),
    value: value === null ? null : (value as number),
    hasData: value !== null,
  };
}

/** Validates the JSON at the network boundary; TypeScript types alone do not make remote JSON safe. */
export function parseHexDataset(raw: unknown): HexDataset {
  if (!isRecord(raw)) fail('berkas bukan objek');
  const metadata = raw['metadata'];
  if (!isRecord(metadata)) fail('metadata hilang');
  if (metadata['kind'] !== 'DEMO_SIMULATION') fail('berkas ini harus bertanda DEMO_SIMULATION');
  const origin = metadata['origin'];
  if (!isRecord(origin)) fail('origin hilang');
  const cells = raw['cells'];
  if (!Array.isArray(cells) || cells.length === 0) fail('daftar sel kosong');
  return {
    hexSizeDeg: finiteNumber(metadata['hexSizeDeg'], 'hexSizeDeg'),
    origin: {
      lon: finiteNumber(origin['lon'], 'origin.lon'),
      lat: finiteNumber(origin['lat'], 'origin.lat'),
    },
    cells: cells.map((cell, index) => parseCell(cell, index)),
  };
}

export async function loadHexDataset(url: string, signal?: AbortSignal): Promise<HexDataset> {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`Gagal memuat ${url}: HTTP ${String(response.status)}`);
  return parseHexDataset(await response.json());
}

const DATASET_URL = `${import.meta.env.BASE_URL}data/hex-indonesia.json`;
/** A coarser grid for phones: at about 340 px wide the fine one would be 5 px tiles. */
const COMPACT_DATASET_URL = `${import.meta.env.BASE_URL}data/hex-indonesia-compact.json`;
const PHONE_QUERY = '(width < 640px)';

/** The grid for this device: the compact one on phones. */
export function hexDatasetUrl(): string {
  return window.matchMedia(PHONE_QUERY).matches ? COMPACT_DATASET_URL : DATASET_URL;
}

const loading = new Map<string, Promise<HexDataset>>();

/**
 * Loads a grid once per page: the poster (shown while the 3D scene loads) and the scene share the
 * same request. A failed load is forgotten, so a later attempt can retry.
 */
export function loadHexDatasetOnce(url: string): Promise<HexDataset> {
  const existing = loading.get(url);
  if (existing) return existing;
  const request = loadHexDataset(url);
  loading.set(url, request);
  request.catch(() => {
    loading.delete(url);
  });
  return request;
}
