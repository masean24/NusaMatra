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

function parseCell(raw: unknown, index: number): HexCell {
  if (!isRecord(raw)) fail(`sel ${String(index)} bukan objek`);
  const id = raw['id'];
  if (typeof id !== 'string' || id === '') fail(`sel ${String(index)} tanpa id`);
  const hasData = raw['hasData'];
  if (typeof hasData !== 'boolean') fail(`sel ${id} tanpa status data`);
  const value = raw['value'];
  if (hasData) {
    const numeric = finiteNumber(value, `nilai sel ${id}`);
    if (numeric < 0 || numeric > 1) fail(`nilai sel ${id} di luar 0–1`);
  } else if (value !== null) {
    fail(`sel ${id} tanpa data harus bernilai null`);
  }
  return {
    id,
    x: finiteNumber(raw['x'], `x sel ${id}`),
    z: finiteNumber(raw['z'], `z sel ${id}`),
    lon: finiteNumber(raw['lon'], `lon sel ${id}`),
    lat: finiteNumber(raw['lat'], `lat sel ${id}`),
    value: hasData ? (value as number) : null,
    hasData,
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
