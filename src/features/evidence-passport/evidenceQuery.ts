import type { DataMode } from '@/services/api';
import type { SourceStatus } from './evidenceTypes';

/** Route of the Paspor Bukti page. */
export const PASSPORT_PATH = '/paspor-bukti';

/**
 * What a Paspor Bukti is asked to record. This is a REQUEST, not evidence: the page re-fetches
 * everything it shows from the Data Hub. `mode` and `snapshotId` only say what the person who made
 * the link was looking at; the page reports what it actually received and warns when that differs.
 *
 * Shared fields:
 * - `mode`: DEMO or LIVE the link came from. Omitted = the app's current mode.
 * - `snapshotId`: the snapshot the link came from, so the page can say when it has since changed.
 */
interface QueryContext {
  readonly mode?: DataMode | null | undefined;
  readonly snapshotId?: string | null | undefined;
}

/** Evidence on one region. `indicatorIds` limits the record to those indicators (default: all). */
export interface RegionEvidenceQuery extends QueryContext {
  readonly kind: 'wilayah';
  readonly regionId: string;
  readonly indicatorIds?: readonly string[] | undefined;
}

/** Evidence on a side-by-side comparison of two different regions (A then B). */
export interface ComparisonEvidenceQuery extends QueryContext {
  readonly kind: 'bandingkan';
  readonly regionA: string;
  readonly regionB: string;
  readonly indicatorIds?: readonly string[] | undefined;
}

/**
 * Evidence on a Lab Prioritas result. `weights` are the weights the user REQUESTED, in integer
 * basis points summing to exactly 10 000. Not rendered yet: waits for the final composite contract.
 */
export interface LabEvidenceQuery extends QueryContext {
  readonly kind: 'lab';
  readonly weights: Readonly<Record<string, number>>;
  /** Two-digit province code the ranking was limited to. */
  readonly provinceId?: string | null | undefined;
  /** The region the reader was looking at. */
  readonly focusRegionId?: string | null | undefined;
}

export type EvidenceQuery = RegionEvidenceQuery | ComparisonEvidenceQuery | LabEvidenceQuery;

/** URL parameter names. Region codes reuse the names of Jelajahi (`kode`) and Bandingkan (`a`, `b`). */
const PARAM = {
  kind: 'jenis',
  mode: 'mode',
  snapshot: 'snap',
  region: 'kode',
  regionA: 'a',
  regionB: 'b',
  indicators: 'ind',
  weights: 'bobot',
  province: 'prov',
} as const;

const KIND_OF_PARAM: Readonly<Record<string, EvidenceQuery['kind']>> = {
  wilayah: 'wilayah',
  bandingkan: 'bandingkan',
  lab: 'lab',
};

const REGION_ID = /^[A-Za-z0-9._-]{1,64}$/;
const INDICATOR_ID = /^[A-Za-z0-9._-]{1,80}$/;
const SNAPSHOT_ID = /^[A-Za-z0-9._:-]{1,80}$/;
const PROVINCE_ID = /^[0-9]{2}$/;
const BASIS_POINTS = /^[0-9]{1,5}$/;
const MAX_INDICATORS = 60;
const TOTAL_BASIS_POINTS = 10_000;

/**
 * The link to a Paspor Bukti. STABLE CONTRACT: other features call this with an `EvidenceQuery`
 * and use the returned site-relative path (`/paspor-bukti?...`) as a router `to`/`href`. Parameter
 * order is fixed so equal queries give equal links. Nothing personal is ever put in the link.
 *
 * Example: `passportHref({ kind: 'wilayah', regionId: '3201', mode: 'LIVE', snapshotId: 'x' })`
 * gives `/paspor-bukti?jenis=wilayah&mode=live&snap=x&kode=3201`.
 */
export function passportHref(query: EvidenceQuery): string {
  const params = new URLSearchParams();
  params.set(PARAM.kind, query.kind);
  if (query.mode) params.set(PARAM.mode, query.mode.toLowerCase());
  if (query.snapshotId) params.set(PARAM.snapshot, query.snapshotId);

  switch (query.kind) {
    case 'wilayah':
      params.set(PARAM.region, query.regionId);
      break;
    case 'bandingkan':
      params.set(PARAM.regionA, query.regionA);
      params.set(PARAM.regionB, query.regionB);
      break;
    case 'lab': {
      const weights = Object.entries(query.weights)
        .filter(([, bps]) => bps > 0)
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([id, bps]) => `${id}:${String(bps)}`)
        .join(',');
      params.set(PARAM.weights, weights);
      if (query.provinceId) params.set(PARAM.province, query.provinceId);
      if (query.focusRegionId) params.set(PARAM.region, query.focusRegionId);
      break;
    }
  }
  if (query.kind !== 'lab' && query.indicatorIds && query.indicatorIds.length > 0) {
    params.set(PARAM.indicators, [...new Set(query.indicatorIds)].join(','));
  }
  return `${PASSPORT_PATH}?${params.toString()}`;
}

/**
 * The address to copy, share and export for a record. When the record was pinned to a snapshot, the
 * address names that snapshot (and its mode), so opening it again asks for the same data, even when
 * the page itself was opened without one. Otherwise the address as opened.
 */
export function shareablePassportPath(
  search: string,
  source: Pick<SourceStatus, 'dataMode' | 'reproducibility'>,
): string {
  const parsed = parseEvidenceQuery(new URLSearchParams(search));
  const { status, pinnedSnapshotId } = source.reproducibility;
  if (status !== 'REPRODUCIBLE_SNAPSHOT' || !pinnedSnapshotId || !parsed.ok) {
    return `${PASSPORT_PATH}${search}`;
  }
  return passportHref({ ...parsed.query, mode: source.dataMode, snapshotId: pinnedSnapshotId });
}

export type ParsedEvidenceQuery =
  { readonly ok: true; readonly query: EvidenceQuery } | { readonly ok: false; readonly message: string };

const invalid = (message: string): ParsedEvidenceQuery => ({ ok: false, message });

function readMode(raw: string | null): DataMode | null | 'invalid' {
  if (raw === null) return null;
  const upper = raw.trim().toUpperCase();
  return upper === 'LIVE' || upper === 'DEMO' ? upper : 'invalid';
}

function readIndicatorIds(raw: string | null): readonly string[] | 'invalid' | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const ids = [...new Set(raw.split(',').map((id) => id.trim()))];
  if (ids.length > MAX_INDICATORS || ids.some((id) => !INDICATOR_ID.test(id))) return 'invalid';
  return ids;
}

function readWeights(raw: string | null): Record<string, number> | null {
  if (raw === null || raw.trim() === '') return null;
  const weights: Record<string, number> = {};
  for (const part of raw.split(',')) {
    const [id, bps, ...rest] = part.split(':');
    if (!id || bps === undefined || rest.length > 0 || !INDICATOR_ID.test(id)) return null;
    if (!BASIS_POINTS.test(bps) || Object.prototype.hasOwnProperty.call(weights, id)) return null;
    weights[id] = Number(bps);
  }
  const total = Object.values(weights).reduce((sum, bps) => sum + bps, 0);
  return total === TOTAL_BASIS_POINTS ? weights : null;
}

/**
 * Reads and validates a link. Anything malformed is rejected with a reason rather than repaired, so
 * the page never shows a record for a request the link did not actually make.
 */
export function parseEvidenceQuery(params: URLSearchParams): ParsedEvidenceQuery {
  const rawKind = params.get(PARAM.kind);
  if (rawKind === null) {
    return invalid(
      'Tautan tidak menyebut jenis bukti. Buka Paspor Bukti dari Jelajahi, Bandingkan, atau Lab Prioritas.',
    );
  }
  const kind = KIND_OF_PARAM[rawKind];
  if (!kind) return invalid(`Jenis bukti "${rawKind}" tidak dikenal.`);

  const mode = readMode(params.get(PARAM.mode));
  if (mode === 'invalid') return invalid('Mode pada tautan harus "live" atau "demo".');

  const rawSnapshot = params.get(PARAM.snapshot);
  if (rawSnapshot !== null && !SNAPSHOT_ID.test(rawSnapshot)) {
    return invalid('ID snapshot pada tautan tidak valid.');
  }
  const context: QueryContext = { mode, snapshotId: rawSnapshot };

  if (kind === 'lab') {
    const weights = readWeights(params.get(PARAM.weights));
    if (!weights) {
      return invalid('Bobot pada tautan harus berupa bilangan bulat basis poin dengan total tepat 10.000.');
    }
    const province = params.get(PARAM.province);
    if (province !== null && !PROVINCE_ID.test(province)) {
      return invalid('Kode provinsi pada tautan tidak valid.');
    }
    const focus = params.get(PARAM.region);
    if (focus !== null && !REGION_ID.test(focus)) return invalid('Kode wilayah pada tautan tidak valid.');
    return { ok: true, query: { kind, ...context, weights, provinceId: province, focusRegionId: focus } };
  }

  const indicatorIds = readIndicatorIds(params.get(PARAM.indicators));
  if (indicatorIds === 'invalid') return invalid('Daftar indikator pada tautan tidak valid.');

  if (kind === 'wilayah') {
    const regionId = params.get(PARAM.region);
    if (regionId === null) return invalid('Tautan tidak menyebut kode wilayah.');
    if (!REGION_ID.test(regionId)) return invalid('Kode wilayah pada tautan tidak valid.');
    return { ok: true, query: { kind, ...context, regionId, indicatorIds } };
  }

  const regionA = params.get(PARAM.regionA);
  const regionB = params.get(PARAM.regionB);
  if (regionA === null || regionB === null) {
    return invalid('Perbandingan memerlukan dua kode wilayah (A dan B).');
  }
  if (!REGION_ID.test(regionA) || !REGION_ID.test(regionB)) {
    return invalid('Kode wilayah pada tautan tidak valid.');
  }
  if (regionA === regionB) return invalid('Perbandingan memerlukan dua wilayah yang berbeda.');
  return { ok: true, query: { kind, ...context, regionA, regionB, indicatorIds } };
}

/** The Data Hub region codes a query needs a profile for. Lab needs none yet. */
export function regionIdsOf(query: EvidenceQuery): readonly string[] {
  if (query.kind === 'wilayah') return [query.regionId];
  if (query.kind === 'bandingkan') return [query.regionA, query.regionB];
  return [];
}
