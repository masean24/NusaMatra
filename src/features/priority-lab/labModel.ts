/**
 * Plain view logic of Lab Prioritas: which indicators can be chosen, the starting weights, and the
 * readable explanation of a composite result. Pure and UI-free; every number shown comes from the
 * Data Hub or is arithmetic on it that the integrity check has already verified.
 */
import { TOTAL_BASIS_POINTS, scaleToTotal, type DirectionVerdict } from '@/domain/prioritization';
import type {
  CompositePresetDTO,
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
  /** Regions with a value as a percentage, as the Data Hub reports it (used when it states no registry size). */
  readonly coveragePct: number | null;
  readonly totalRegions: number | null;
}

/** "487 dari 514 wilayah", or "487 wilayah (94,7%)" when the Data Hub states no registry size. */
export function indicatorCoverageText(option: IndicatorOption): string | null {
  if (option.coverageCount === null) return null;
  if (option.totalRegions !== null) {
    return `${String(option.coverageCount)} dari ${String(option.totalRegions)} wilayah`;
  }
  if (option.coveragePct === null) return `${String(option.coverageCount)} wilayah`;
  const pct = option.coveragePct.toLocaleString('id-ID', { maximumFractionDigits: 1 });
  return `${String(option.coverageCount)} wilayah (${pct}%)`;
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
      coveragePct: entry?.coveragePct ?? null,
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

/**
 * How the indicator's RAW value relates to the Lab score, which is a need score (`higher_is_need`): a
 * better raw condition always means a LOWER need score, so a "positive" indicator (HDI, safe water)
 * lowers the score as it rises and a "negative" one (poverty, hazard) raises it.
 */
export function directionLabel(polarity: string): string {
  if (polarity === 'positive') return 'Nilai tinggi = kondisi lebih baik (skor kebutuhan lebih rendah)';
  if (polarity === 'negative') return 'Nilai rendah = kondisi lebih baik (skor kebutuhan lebih rendah)';
  return 'Arah tergantung konteks';
}

/** What the 0–100 score and rank mean (contract v2.1, `score_direction: higher_is_need`). */
/** The one sentence above the ranking; SCORE_MEANING is the full reading, under "Cara membaca skor". */
export const SCORE_SUMMARY =
  'Skor 0–100: makin tinggi, makin tinggi kebutuhan intervensi menurut kriteria pilihan Anda (relatif, bukan mutlak).';

export const SCORE_MEANING =
  'Skor 0–100 menunjukkan tingkat kebutuhan intervensi relatif pada kriteria pilihan Anda: makin tinggi skor, makin tinggi kebutuhannya, dan peringkat 1 adalah prioritas tertinggi. Ini perbandingan relatif, bukan penilaian mutlak.';

/** Reader-facing names of the quality flags the Data Hub sends; unknown ones are shown as they are. */
export function qualityFlagLabel(flag: string): string {
  if (flag === 'VERIFIED') return 'Terverifikasi';
  if (flag === 'IMPUTED_PROVINCE') return 'Estimasi tingkat provinsi';
  if (flag === 'DEMO_EXAMPLE') return 'Contoh simulasi';
  return flag;
}

/** Criteria of a region whose value is an estimate from the province, not a kabupaten/kota measurement. */
export function imputedCriteria(item: ExploratoryRegionRankDTO): string[] {
  return Object.entries(item.qualityFlags ?? {})
    .filter(([, flag]) => flag === 'IMPUTED_PROVINCE')
    .map(([id]) => id);
}

/** The Data Hub preset these weights exactly equal, if any (the first, when several are identical). */
export function matchingPreset(
  weights: Readonly<Record<string, number>>,
  presets: readonly CompositePresetDTO[] | null,
): CompositePresetDTO | null {
  return (
    presets?.find((preset) => {
      const ids = new Set([...Object.keys(weights), ...Object.keys(preset.weightsBasisPoints)]);
      return [...ids].every((id) => (weights[id] ?? 0) === (preset.weightsBasisPoints[id] ?? 0));
    }) ?? null
  );
}

/** The Data Hub's own verdict for a preset; `null` when it did not report one (that is not "yes"). */
export function declaredRankable(preset: CompositePresetDTO | null): boolean | null {
  return preset?.availability?.rankable ?? null;
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
  /** Normalised 0–100 need score of the indicator for this region (100 = highest need in the set). */
  readonly score: number;
  /** The region's own weight in basis points (`effective_weights_region`; the global one before v2.1). */
  readonly weight: number;
  /** Points this indicator adds to the composite: score × weight. */
  readonly points: number;
  /** Quality flag of this component, when the Data Hub reports one. */
  readonly quality: string | null;
}

/**
 * How one region's composite is made up, with the region's OWN weights over the components it has.
 * A component without an observation is not listed (it is "Data tidak tersedia", never a zero row).
 * Only called for results that passed the integrity check, so the points add up to the reported score
 * within rounding.
 */
export function contributions(
  item: ExploratoryRegionRankDTO,
  weightsUsed: Readonly<Record<string, number>>,
): ContributionRow[] {
  const weights = item.effectiveWeightsRegion ?? weightsUsed;
  return Object.entries(weights)
    .filter(([id, weight]) => weight > 0 && item.componentScoresDecimal[id] != null)
    .map(([id, weight]) => {
      const score = Number(item.componentScoresDecimal[id] ?? Number.NaN);
      return {
        id,
        score,
        weight,
        points: (score * weight) / TOTAL_BASIS_POINTS,
        quality: item.qualityFlags?.[id] ?? null,
      };
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

/**
 * Registry regions (of the province, if filtered) that appear neither in the ranking nor in the
 * Data Hub's own list of regions without enough data.
 */
export function excludedRegions(
  registry: readonly DataHubRegionDTO[],
  result: ExploratoryCompositeResultDTO,
): DataHubRegionDTO[] {
  const listed = new Set([
    ...result.items.map((item) => item.regionId),
    ...result.insufficient.map((region) => region.regionId),
  ]);
  return registry.filter(
    (region) =>
      (result.filterProvinceId === null || region.parentRegionId === result.filterProvinceId) &&
      !listed.has(region.regionId),
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

/** True when the direction of the indicator was NOT fully verified against its source (shown, never silent). */
export function isDirectionUnverified(verdict: DirectionVerdict): boolean {
  return verdict.status === 'partial' || verdict.status === 'unverified' || verdict.status === 'unverifiable';
}

/**
 * One line per indicator for the technical details: what the direction check found, in words, with the
 * estimates it could not verify named by region and value.
 */
export function directionVerdictText(
  verdict: DirectionVerdict,
  regionName: (regionId: string) => string = (regionId) => regionId,
): string {
  switch (verdict.status) {
    case 'consistent':
      return verdict.imputedChecked === 0
        ? `sesuai data sumber (${String(verdict.checked)} wilayah)`
        : `sesuai data sumber (${String(verdict.checked)} wilayah, termasuk ${String(verdict.imputedChecked)} estimasi tingkat provinsi yang cocok dengan urutan)`;
    case 'partial': {
      const named = verdict.unverified
        .map(
          (item) =>
            `${regionName(item.regionId)}: nilai mentah ${String(item.raw)} → skor ${String(item.score)}`,
        )
        .join('; ');
      return `BELUM TERVERIFIKASI PENUH — ${verdict.reason} ${String(verdict.checked)} wilayah lain sesuai. Tidak diverifikasi: ${named}.`;
    }
    case 'unverified':
      return `BELUM TERVERIFIKASI — ${verdict.reason}`;
    case 'unverifiable':
      return `belum dapat diperiksa — ${verdict.reason}`;
    case 'inconsistent':
      return `tidak sesuai — ${verdict.reason}`;
  }
}
