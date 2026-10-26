import { describeUnit } from '@/domain/indicators';
import {
  assessCompositeIntegrity,
  assessDirectionImpact,
  classifyCoverage,
  EXPECTED_SCORE_DIRECTION,
  type CompositeIssue,
  type CompositeIssueCode,
} from '@/domain/prioritization';
import { formatDecimalId, publicHttpUrl } from '@/features/data-hub';
import {
  checkRankingDirections,
  declaredRankable,
  impactRowsOf,
  integrityInputFromResult,
  matchingPreset,
} from '@/features/priority-lab';
import type {
  DataHubDatasetDTO,
  DataHubIndicatorDTO,
  ExploratoryCompositeResultDTO,
  ExploratoryRegionRankDTO,
  InsufficientRegionDTO,
} from '@/services/api';
import {
  assessLinkContext,
  nonPlaceholder,
  sourceStatusOf,
  summariseSourceUses,
  UNKNOWN_AGENCY,
  UNKNOWN_DATASET,
} from './buildEvidenceRecord';
import { buildCompositeLimitations } from './compositeLimitations';
import { fetchedForComposite } from './fetchLog';
import { scopeLabel } from './scopeLabel';
import type {
  CompositeEvidenceRecord,
  CompositeIndicatorInfo,
  CompositeIssueView,
  CompositeRegionRow,
  FocusView,
  InsufficientRegionRow,
  IssueOrigin,
  PresetView,
  RawCompositeSources,
  RegionComponent,
} from './compositeTypes';
import { classifyEvidence } from './evidenceClass';
import type { LabEvidenceQuery } from './evidenceQuery';
import type { IndicatorSourceInfo } from './evidenceTypes';

const ORIGIN_OF: Readonly<Partial<Record<CompositeIssueCode, IssueOrigin>>> = {
  REQUESTED_WEIGHT_AVAILABILITY_LOW: 'policy',
  PRESET_NOT_RANKABLE: 'datahub',
};

export const ORIGIN_LABEL: Readonly<Record<IssueOrigin, string>> = {
  policy: 'Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub)',
  datahub: 'Penanda dari Data Hub (rankable = false)',
  check: 'Pemeriksaan konsistensi antarmuka atas respons Data Hub',
};

/** What a score and rank mean, stated only when the Data Hub declared the expected direction. */
const SCORE_MEANING_NEED =
  'Skor 0–100 menunjukkan tingkat kebutuhan intervensi relatif pada kriteria dan bobot ini: makin tinggi skor, makin tinggi kebutuhan, dan peringkat 1 adalah prioritas tertinggi. Ini perbandingan relatif, bukan penilaian mutlak dan bukan keputusan kebijakan.';
const SCORE_MEANING_UNCONFIRMED =
  'Arah skor tidak dinyatakan sebagai "higher_is_need" oleh Data Hub, sehingga arti skor dan peringkat tidak dapat dibaca dengan aman.';

const REASON_TEXT: Readonly<Record<string, string>> = {
  COVERAGE_BELOW_THRESHOLD: 'Data kriteria terlalu sedikit (cakupan di bawah batas minimum Data Hub).',
};

function issueView(issue: CompositeIssue): CompositeIssueView {
  const origin = ORIGIN_OF[issue.code] ?? 'check';
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    origin,
    originLabel: ORIGIN_LABEL[origin],
    count: issue.count,
    examples: issue.examples ?? [],
  };
}

function sameWeights(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...ids].every((id) => (a[id] ?? 0) === (b[id] ?? 0));
}

function sourceOfCatalog(
  item: DataHubIndicatorDTO | undefined,
  dataset: DataHubDatasetDTO | undefined,
): IndicatorSourceInfo {
  return {
    agencyCode:
      (item ? nonPlaceholder(item.provenance.agencyCode, UNKNOWN_AGENCY) : null) ??
      dataset?.agencyCode ??
      null,
    datasetId: item ? nonPlaceholder(item.provenance.datasetId, UNKNOWN_DATASET) : null,
    datasetTitle: dataset?.datasetTitle ?? item?.provenance.datasetTitle ?? null,
    officialUrl:
      publicHttpUrl(item?.provenance.officialPortalUrl ?? null) ??
      publicHttpUrl(dataset?.officialPortalUrl ?? null),
  };
}

interface Lookups {
  readonly catalogById: ReadonlyMap<string, DataHubIndicatorDTO>;
  readonly catalogLoaded: boolean;
  readonly unavailable: ReadonlySet<string>;
  readonly indicatorIds: readonly string[];
  readonly globalWeights: Readonly<Record<string, number>>;
  readonly tierThreshold: number | null;
  readonly focusRegionId: string | null;
  /** LIVE: published values per weighted indicator, for observation-level provenance (v2.2). */
  readonly indicatorValues: RawCompositeSources['indicatorValues'];
}

function rowOf(item: ExploratoryRegionRankDTO, lookups: Lookups): CompositeRegionRow {
  const components = lookups.indicatorIds
    .filter((id) => !lookups.unavailable.has(id))
    .map((id): RegionComponent => {
      const raw = item.componentScoresDecimal[id] ?? null;
      const flag = item.qualityFlags?.[id] ?? null;
      const catalogItem = lookups.catalogById.get(id);
      const observation = lookups.indicatorValues?.[id]?.data.valuesByRegion[item.regionId] ?? null;
      return {
        indicatorId: id,
        label: catalogItem?.labelId ?? id,
        // A missing score is "tidak tersedia"; only a score the Data Hub sent can be shown as a number.
        scoreText: raw === null ? 'tidak tersedia' : formatDecimalId(raw),
        scoreRaw: raw,
        hasScore: raw !== null,
        weightBps: item.effectiveWeightsRegion?.[id] ?? null,
        flag,
        observationDatasetId: observation?.datasetId ?? null,
        sourceRecordRef: observation?.sourceRecordRef ?? null,
        catalogDatasetId: catalogItem?.provenance.datasetId ?? null,
        evidenceClass:
          raw === null
            ? null
            : classifyEvidence({
                flag,
                isDemoExample: flag === 'DEMO_EXAMPLE',
                catalogAvailability: catalogItem?.availabilityStatus ?? null,
                catalogLoaded: lookups.catalogLoaded,
              }).evidenceClass,
      };
    });
  return {
    regionId: item.regionId,
    name: item.regionDisplayName,
    rank: item.rankPosition,
    nationalRank: item.nationalRank,
    scoreText: item.compositeScoreDecimal === null ? null : formatDecimalId(item.compositeScoreDecimal),
    scoreRaw: item.compositeScoreDecimal,
    coveragePct: item.coveragePct,
    tier: classifyCoverage(item.coveragePct, lookups.tierThreshold),
    components,
    missingIndicators: (item.missingIndicators ?? []).filter((id) => !lookups.unavailable.has(id)),
    imputedIndicators: components
      .filter((component) => component.flag === 'IMPUTED_PROVINCE')
      .map((component) => component.indicatorId),
    weightsDiffer:
      item.effectiveWeightsRegion !== null &&
      !sameWeights(item.effectiveWeightsRegion, lookups.globalWeights),
    effectiveWeightsRegion: item.effectiveWeightsRegion,
    isFocus: item.regionId === lookups.focusRegionId,
  };
}

function insufficientRowOf(region: InsufficientRegionDTO, lookups: Lookups): InsufficientRegionRow {
  return {
    regionId: region.regionId,
    name: region.regionDisplayName,
    coveragePct: region.coveragePct,
    componentsUsed: region.componentsUsed,
    missingIndicators: region.missingIndicators,
    reason: region.reason,
    reasonText: REASON_TEXT[region.reason] ?? `Alasan dari Data Hub: ${region.reason}`,
    componentScores: region.componentScoresDecimal,
    isFocus: region.regionId === lookups.focusRegionId,
  };
}

/**
 * The province's name as the Data Hub's region registry gives it (the same registry call Lab uses to
 * list provinces). `null` when the registry was not loaded or holds no region of that province; the
 * caller then shows the code and says the name is unavailable. No name is ever written in code.
 */
function provinceNameOf(provinceId: string | null, raw: RawCompositeSources): string | null {
  if (provinceId === null || raw.regions === null) return null;
  const match = raw.regions.data.find(
    (region) => region.parentRegionId === provinceId && region.provinceName !== null,
  );
  return match?.provinceName ?? null;
}

function focusOf(
  regionId: string | null,
  provinceId: string | null,
  result: ExploratoryCompositeResultDTO,
  rows: readonly CompositeRegionRow[],
  insufficient: readonly InsufficientRegionRow[],
  withheld: boolean,
): FocusView | null {
  if (regionId === null) return null;
  if (withheld) {
    return {
      regionId,
      status: 'WITHHELD',
      name: null,
      message: `Peringkat ditahan, sehingga posisi wilayah ${regionId} tidak dinyatakan dari hasil ini.`,
    };
  }
  const row = rows.find((candidate) => candidate.regionId === regionId);
  if (row) {
    return {
      regionId,
      status: 'RANKED',
      name: row.name,
      message: `${row.name}: peringkat ${String(row.rank ?? 'belum tersedia')} dari ${String(result.totalRegions)} wilayah pada daftar ini; peringkat nasional ${String(row.nationalRank ?? 'belum tersedia')}${result.totalEligibleNational === null ? '' : ` dari ${String(result.totalEligibleNational)} wilayah yang memenuhi syarat`}; cakupan data ${row.coveragePct === null ? 'belum tersedia' : `${String(row.coveragePct)}%`}.`,
    };
  }
  const unranked = insufficient.find((candidate) => candidate.regionId === regionId);
  if (unranked) {
    return {
      regionId,
      status: 'NOT_RANKED',
      name: unranked.name,
      message: `${unranked.name} tidak diperingkat: ${unranked.reasonText} Wilayah ini tidak mendapat skor ataupun peringkat.`,
    };
  }
  const outsideProvince = provinceId !== null && !regionId.startsWith(provinceId);
  return {
    regionId,
    status: 'ABSENT',
    name: null,
    message: `Wilayah ${regionId} tidak ada dalam hasil ini, baik di daftar peringkat maupun di daftar tidak diperingkat.${outsideProvince ? ` Kodenya bukan bagian dari provinsi ${provinceId} yang menjadi cakupan hasil.` : ''}`,
  };
}

/**
 * Assembles the evidence for a Lab Prioritas result from Data Hub responses. It records what the
 * Data Hub returned: scores and ranks are never recomputed or re-sorted, a missing score stays
 * missing, and the ranking is shown only when the shared integrity check finds nothing blocking.
 */
export function buildCompositeRecord(
  query: LabEvidenceQuery,
  raw: RawCompositeSources,
): CompositeEvidenceRecord {
  const result = raw.composite.data;
  const presets = raw.presets?.data.presets ?? null;
  const preset = matchingPreset(query.weights, presets);
  const rankable = declaredRankable(preset);
  const integrity = assessCompositeIntegrity(integrityInputFromResult(result, null, query.weights, rankable));

  const source = sourceStatusOf(
    [
      raw.composite.meta,
      ...(raw.presets ? [raw.presets.meta] : []),
      ...(raw.catalog ? [raw.catalog.meta] : []),
      ...(raw.datasets ? [raw.datasets.meta] : []),
      ...Object.values(raw.indicatorValues ?? {}).flatMap((envelope) => (envelope ? [envelope.meta] : [])),
    ],
    raw.pinning,
    raw.snapshots,
    raw.coverage,
  );

  const catalogItems = raw.catalog?.data.items ?? [];
  const catalogById = new Map(catalogItems.map((item) => [item.indicatorId, item]));

  // LIVE: the same direction check as Lab Prioritas. Nothing is recalculated or corrected here.
  const live = raw.requestedMode === 'LIVE';
  const weightedIds = Object.keys(integrity.weightsUsed)
    .filter((id) => (integrity.weightsUsed[id] ?? 0) > 0)
    .sort();
  const checks =
    live && integrity.ok
      ? checkRankingDirections(
          result,
          weightedIds,
          (indicatorId) => catalogById.get(indicatorId)?.polarity ?? '',
          (indicatorId) => raw.indicatorValues?.[indicatorId]?.data ?? null,
        )
      : [];
  const impact =
    checks.length > 0
      ? assessDirectionImpact({
          checks,
          rows: impactRowsOf(result),
          weightsUsed: integrity.weightsUsed,
          filterProvinceId: result.filterProvinceId,
        })
      : ({ status: 'clear' } as const);
  const inconsistentIds = checks
    .filter((check) => check.verdict.status === 'inconsistent')
    .map((check) => check.indicatorId);
  const direction: CompositeEvidenceRecord['direction'] = {
    checked: live,
    anomalies: impact.status === 'clear' ? [] : impact.anomalies,
    inconsistentIndicatorIds: inconsistentIds,
    nationalRankWithheld: impact.status === 'national_rank_withheld',
    notFullyVerifiedIndicatorIds: checks
      .filter(({ verdict }) => ['partial', 'unverified', 'unverifiable'].includes(verdict.status))
      .map((check) => check.indicatorId),
  };

  const withheldReason: CompositeEvidenceRecord['withheldReason'] = !integrity.ok
    ? 'INTEGRITY'
    : !source.consistent
      ? 'MIXED_SOURCES'
      : inconsistentIds.length > 0 || impact.status === 'ranking_withheld'
        ? 'DIRECTION_ANOMALY'
        : null;
  const withheld = withheldReason !== null;
  const datasetsById = new Map((raw.datasets?.data ?? []).map((dataset) => [dataset.datasetId, dataset]));
  const unavailable = new Set(result.unavailableIndicatorIds ?? []);
  const indicatorIds = Object.entries(result.weightsBasisPoints)
    .filter(([, bps]) => bps > 0)
    .map(([id]) => id);

  const indicators = indicatorIds.map((id): CompositeIndicatorInfo => {
    const item = catalogById.get(id);
    const dataset = item ? datasetsById.get(item.provenance.datasetId) : undefined;
    return {
      indicatorId: id,
      label: item?.labelId ?? id,
      category: item?.category ?? '',
      unitLabel: item ? describeUnit(item.unitCode, null).label : '',
      referenceYear: item?.referenceYear ?? null,
      polarity: item?.polarity ?? null,
      source: sourceOfCatalog(item, dataset),
      requestedBps: query.weights[id] ?? result.weightsBasisPoints[id] ?? 0,
      effectiveBps: unavailable.has(id) ? null : (result.effectiveWeightsBasisPoints?.[id] ?? null),
      nationallyAvailable: !unavailable.has(id),
    };
  });

  const lookups: Lookups = {
    catalogById,
    catalogLoaded: raw.catalog !== null,
    unavailable,
    indicatorIds,
    globalWeights: result.effectiveWeightsBasisPoints ?? result.weightsBasisPoints,
    tierThreshold: result.minCoveragePct,
    focusRegionId: query.focusRegionId ?? null,
    indicatorValues: raw.indicatorValues,
  };
  // National ranks reached by an anomaly outside the filter are left out, never recomputed.
  const listed = direction.nationalRankWithheld
    ? result.items.map((item) => ({ ...item, nationalRank: null }))
    : result.items;
  const rows = withheld ? [] : listed.map((item) => rowOf(item, lookups));
  const insufficient = withheld
    ? []
    : result.insufficient.map((region) => insufficientRowOf(region, lookups));

  const presetView: PresetView | null = preset
    ? {
        presetId: preset.presetId,
        label: preset.label,
        rankable,
        requestedWeightAvailabilityPct: preset.availability?.requestedWeightAvailabilityPct ?? null,
      }
    : null;

  const sources = summariseSourceUses(
    indicators.map((indicator) => ({
      source: indicator.source,
      year: indicator.referenceYear,
      indicatorId: indicator.indicatorId,
    })),
    datasetsById,
  );

  const provinceName = provinceNameOf(query.provinceId ?? null, raw);
  const scopeText = scopeLabel(query.provinceId ?? null, provinceName);
  const issues = [...integrity.issues]
    .sort((a, b) => Number(b.severity === 'block') - Number(a.severity === 'block'))
    .map(issueView);

  const base = {
    kind: 'lab' as const,
    title: `Bukti hasil Lab Prioritas (${scopeText})`,
    question:
      'Wilayah mana yang paling membutuhkan intervensi menurut kriteria dan bobot ini, seberapa lengkap datanya, dan apakah hasilnya dapat dipercaya untuk dibaca sebagai peringkat?',
    source,
    sources,
    linkWarnings: assessLinkContext(query, source),
    unavailableSources: [
      ...(raw.presets ? [] : ['daftar skenario (preset)']),
      ...(raw.catalog ? [] : ['katalog indikator']),
      ...(raw.datasets ? [] : ['daftar dataset']),
      ...(raw.snapshots || raw.pinning.status === 'PINNED' ? [] : ['daftar snapshot']),
      ...(raw.coverage || raw.requestedMode === 'DEMO' ? [] : ['cakupan indikator (/indicators/coverage)']),
      ...(query.provinceId && !raw.regions ? ['daftar wilayah (nama provinsi)'] : []),
    ],
    fetched: fetchedForComposite(query, raw),
    scope: {
      provinceId: query.provinceId ?? null,
      provinceName,
      totalRegions: result.totalRegions,
      totalEligibleNational: result.totalEligibleNational,
      totalExcluded: result.totalExcluded,
      minCoveragePct: result.minCoveragePct,
      minComponents: result.minComponents,
      scoreDirection: result.scoreDirection,
    },
    requestedWeights: query.weights,
    effectiveWeights: result.effectiveWeightsBasisPoints,
    renormalized: result.renormalized,
    unavailableIndicatorIds: [...unavailable],
    preset: presetView,
    integrity: {
      ok: integrity.ok,
      issues,
      maxScoreError: integrity.maxScoreError,
      requestedWeightAvailabilityPct: integrity.requestedWeightAvailabilityPct,
      coverageTiers: integrity.coverageTiers,
    },
    ranking: withheld ? ('WITHHELD' as const) : ('SHOWN' as const),
    withheldReason,
    direction,
    serverRankedCount: result.items.length,
    rows,
    insufficient,
    indicators,
    focus: focusOf(
      query.focusRegionId ?? null,
      query.provinceId ?? null,
      result,
      rows,
      insufficient,
      withheld,
    ),
    scoreMeaning:
      result.scoreDirection === EXPECTED_SCORE_DIRECTION ? SCORE_MEANING_NEED : SCORE_MEANING_UNCONFIRMED,
  };
  return { ...base, limitations: buildCompositeLimitations(base) };
}
