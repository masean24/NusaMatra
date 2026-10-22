/**
 * Plain view logic of Lab Prioritas: which indicators can be chosen, the starting weights, and the
 * readable explanation of a composite result. Pure and UI-free; every number shown comes from the
 * Data Hub or is arithmetic on it that the integrity check has already verified.
 */
import { TOTAL_BASIS_POINTS, scaleToTotal } from '@/domain/prioritization';
import type {
  DataHubRegionDTO,
  DataMode,
  ExploratoryCompositeResultDTO,
  ExploratoryRegionRankDTO,
  IndicatorCatalogDTO,
  IndicatorCoverageDTO,
} from '@/services/api';
import { DEFAULT_CRITERIA, LIVE_CRITERIA } from './criteria';

export type Availability = 'available' | 'empty' | 'undeclared';

export interface IndicatorOption {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly unit: string;
  readonly agency: string | null;
  readonly referenceYear: number | null;
  readonly polarity: string;
  /** In DEMO every indicator is simulated, so all count as available. */
  readonly availability: Availability;
  readonly coverageCount: number | null;
  readonly totalRegions: number | null;
}

/** Joins the catalog with the coverage matrix. Without coverage (DEMO) every indicator is selectable. */
export function buildIndicatorOptions(
  catalog: IndicatorCatalogDTO,
  coverage: IndicatorCoverageDTO | null,
): IndicatorOption[] {
  return catalog.items.map((item) => {
    const entry = coverage?.byIndicator[item.indicatorId];
    const availability: Availability = !coverage
      ? 'available'
      : !entry
        ? 'undeclared'
        : entry.available
          ? 'available'
          : 'empty';
    return {
      id: item.indicatorId,
      label: item.labelId,
      category: item.category,
      unit: item.unitLabelId,
      // The catalog mapper fills a missing agency with a placeholder code; that is not an agency.
      agency:
        item.provenance.agencyCode && item.provenance.agencyCode !== 'UNKNOWN_AGENCY'
          ? item.provenance.agencyCode
          : null,
      referenceYear: item.referenceYear,
      polarity: item.polarity,
      availability,
      coverageCount: entry?.coverageCount ?? null,
      totalRegions: coverage?.totalRegions ?? null,
    };
  });
}

/** Why an indicator cannot be chosen, in plain Indonesian; `null` when it can. */
export function unavailableReason(option: IndicatorOption): string | null {
  if (option.availability === 'empty') return 'Belum ada data resmi untuk indikator ini pada snapshot LIVE.';
  if (option.availability === 'undeclared')
    return 'Data Hub belum menyatakan ketersediaan data indikator ini.';
  return null;
}

/** "Makin tinggi makin baik" etc.: how the indicator's raw value relates to the score. */
export function directionLabel(polarity: string): string {
  if (polarity === 'positive') return 'Nilai tinggi = kondisi lebih baik';
  if (polarity === 'negative') return 'Nilai rendah = kondisi lebih baik';
  return 'Arah tergantung konteks';
}

/**
 * Starting weights: the mode's default criteria that can be chosen right now. A default criterion
 * without data is left out (and the rest scaled back to 100 %) rather than silently weighted; the
 * ones left out are returned so the page can say so.
 */
export function startingWeights(
  dataMode: DataMode,
  options: readonly IndicatorOption[],
): { readonly weights: Record<string, number>; readonly dropped: readonly string[] } {
  const defaults: Readonly<Record<string, number>> = dataMode === 'LIVE' ? LIVE_CRITERIA : DEFAULT_CRITERIA;
  const choosable = new Set(options.filter((option) => option.availability === 'available').map((o) => o.id));
  const kept = Object.fromEntries(Object.entries(defaults).filter(([id]) => choosable.has(id)));
  const dropped = Object.keys(defaults).filter((id) => !choosable.has(id));
  return { weights: Object.keys(kept).length === 0 ? {} : { ...scaleToTotal(kept) }, dropped };
}

/** Basis points as a percentage for display ("43,75 %"). */
export function percentLabel(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
}

export interface WeightComparisonRow {
  readonly id: string;
  /** What the user chose. */
  readonly chosen: number;
  /** What the Data Hub used; `null` = left out (no data). */
  readonly used: number | null;
}

/** The user's weights next to the weights the calculation used. */
export function compareWeights(result: ExploratoryCompositeResultDTO): WeightComparisonRow[] {
  const used = result.effectiveWeightsBasisPoints ?? result.weightsBasisPoints;
  const unavailable = new Set(result.unavailableIndicatorIds ?? []);
  return Object.entries(result.weightsBasisPoints)
    .filter(([, bps]) => bps > 0)
    .map(([id, chosen]) => ({ id, chosen, used: unavailable.has(id) ? null : (used[id] ?? null) }));
}

export interface ContributionRow {
  readonly id: string;
  /** Normalised 0–100 score of the indicator for this region (100 = best condition in the set). */
  readonly score: number;
  readonly weight: number;
  /** Points this indicator adds to the composite: score × weight. */
  readonly points: number;
}

/**
 * How one region's composite is made up. Only called for results that passed the integrity check,
 * so the points add up to the reported score within rounding.
 */
export function contributions(
  item: ExploratoryRegionRankDTO,
  weightsUsed: Readonly<Record<string, number>>,
): ContributionRow[] {
  return Object.entries(weightsUsed)
    .filter(([, weight]) => weight > 0)
    .map(([id, weight]) => {
      const score = Number(item.componentScoresDecimal[id] ?? Number.NaN);
      return { id, score, weight, points: (score * weight) / TOTAL_BASIS_POINTS };
    })
    .sort((a, b) => b.points - a.points);
}

export interface ProvinceOption {
  readonly id: string;
  readonly name: string;
  readonly regionCount: number;
}

/** Provinces of the region registry, by name, with how many kabupaten/kota each holds. */
export function provinceOptions(registry: readonly DataHubRegionDTO[]): ProvinceOption[] {
  const byId = new Map<string, ProvinceOption>();
  for (const region of registry) {
    const id = region.parentRegionId;
    if (!id) continue;
    const current = byId.get(id);
    byId.set(id, {
      id,
      name: region.provinceName ?? `Provinsi ${id}`,
      regionCount: (current?.regionCount ?? 0) + 1,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** Registry regions (of the province, if filtered) that the ranking does not include. */
export function excludedRegions(
  registry: readonly DataHubRegionDTO[],
  result: ExploratoryCompositeResultDTO,
): DataHubRegionDTO[] {
  const ranked = new Set(result.items.map((item) => item.regionId));
  return registry.filter(
    (region) =>
      (result.filterProvinceId === null || region.parentRegionId === result.filterProvinceId) &&
      !ranked.has(region.regionId),
  );
}

/** Rank change per region against an earlier result for the same scope (positive = moved up). */
export function rankMovement(
  previous: ExploratoryCompositeResultDTO | null,
  current: ExploratoryCompositeResultDTO,
): ReadonlyMap<string, number> {
  const moves = new Map<string, number>();
  if (!previous || previous.filterProvinceId !== current.filterProvinceId) return moves;
  const before = new Map(previous.items.map((item) => [item.regionId, item.rankPosition]));
  for (const item of current.items) {
    const was = before.get(item.regionId);
    if (was !== undefined && was !== null && item.rankPosition !== null)
      moves.set(item.regionId, was - item.rankPosition);
  }
  return moves;
}

/** "Kota Surakarta (3372)" when the registry knows the code, else the code. */
export function regionLabel(regionId: string, registry: readonly DataHubRegionDTO[]): string {
  const region = registry.find((entry) => entry.regionId === regionId);
  return region ? `${region.displayName} (${regionId})` : regionId;
}
