import { assessComparison, type ComparableMeasurement } from '@/domain/comparability';
import { describeUnit } from '@/domain/indicators';
import { adminLevelLabel, describeObservation, formatDecimalId, publicHttpUrl } from '@/features/data-hub';
import type {
  AdaptedResponseMeta,
  DataHubDatasetDTO,
  DataHubIndicatorDTO,
  DataHubSnapshotDTO,
  RegionProfileDTO,
  RegionProfileIndicatorValueDTO,
  SnapshotDetailDTO,
} from '@/services/api';
import { classifyEvidence, type EvidenceClass } from './evidenceClass';
import type {
  ComparisonOutcome,
  EvidenceIndicator,
  EvidenceRecord,
  EvidenceRegion,
  EvidenceSourceSummary,
  EvidenceValue,
  IndicatorSourceInfo,
  LinkWarning,
  MissingIndicator,
  RawEvidenceSources,
  RegionCoverage,
  Reproducibility,
  SnapshotDetail,
  SourceStatus,
} from './evidenceTypes';
import type { ComparisonEvidenceQuery, RegionEvidenceQuery } from './evidenceQuery';
import { fetchedForRegions } from './fetchLog';
import { buildLimitations } from './limitations';
import { NOT_PINNED_CONSEQUENCE, REPRODUCIBLE_SNAPSHOT_STATEMENT } from './notices';
import type { SnapshotPinning } from './snapshotResolution';

/** The adapter fills these in when the Data Hub names no dataset or agency; they are not real names. */
export const UNKNOWN_DATASET = 'unknown_dataset';
export const UNKNOWN_AGENCY = 'UNKNOWN_AGENCY';

type SupportedQuery = RegionEvidenceQuery | ComparisonEvidenceQuery;

// ---------------------------------------------------------------------------------------------
// Source status and link context
// ---------------------------------------------------------------------------------------------

function toSnapshotDetail(entry: DataHubSnapshotDTO | SnapshotDetailDTO): SnapshotDetail {
  const detail = 'observationCount' in entry ? entry : null;
  return {
    label: entry.label,
    createdAt: entry.createdAt || null,
    publishedAt: entry.publishedAt || null,
    boundaryVersion: entry.boundaryVersion,
    completenessPct: entry.indicatorCompletenessPct,
    // A checksum is only shown when it is real hex; the browser never verifies it, and the server
    // kept it unchanged while the data under the same snapshot id changed.
    reportedManifestChecksum:
      entry.checksumSyntaxValid && !entry.isChecksumPlaceholder ? entry.rawManifestChecksum : null,
    contentSha256: entry.contentSha256,
    contentHashSpec: detail?.contentHashSpec ?? null,
    isImmutable: entry.isImmutable,
    isReproducible: entry.isReproducible,
    methodologyVersion: detail?.methodologyVersion ?? null,
    observationCount: detail?.observationCount ?? null,
    indicatorCount: detail?.indicatorCount ?? null,
    availableIndicatorCount: detail?.availableIndicatorCount ?? null,
    regionCount: detail?.regionCount ?? null,
    datasetCount: detail?.datasetCount ?? null,
    referencePeriods: detail?.referencePeriods ?? [],
    supersedes: detail?.supersedes ?? null,
    immutabilityNote: detail?.immutabilityNote ?? null,
  };
}

/** Pinned and every response agreeing on id and digest: the data can be fetched again unchanged. */
function reproducibilityOf(
  pinning: SnapshotPinning,
  consistent: boolean,
  digests: readonly (string | null)[],
): Reproducibility {
  if (pinning.status === 'UNPINNED') {
    return {
      status: 'NOT_REPRODUCIBLE',
      pinnedSnapshotId: null,
      contentSha256: null,
      origin: null,
      statement: `${pinning.reason} ${NOT_PINNED_CONSEQUENCE}`,
    };
  }
  const { pin, origin, detail } = pinning;
  if (!consistent || !detail.data.isImmutable || digests.some((digest) => digest !== pin.contentSha256)) {
    return {
      status: 'NOT_REPRODUCIBLE',
      pinnedSnapshotId: pin.snapshotId,
      contentSha256: pin.contentSha256,
      origin,
      statement: `Snapshot ${pin.snapshotId} tidak dinyatakan immutable, atau respons tidak sepakat soal sidik isinya. ${NOT_PINNED_CONSEQUENCE}`,
    };
  }
  return {
    status: 'REPRODUCIBLE_SNAPSHOT',
    pinnedSnapshotId: pin.snapshotId,
    contentSha256: pin.contentSha256,
    origin,
    statement: REPRODUCIBLE_SNAPSHOT_STATEMENT,
  };
}

/**
 * Mode, snapshot and digest are read from the responses; the record is consistent only when all
 * agree. The first envelope is the record's own data; the others are supporting and must match it.
 * When pinned, the snapshot detail describes the snapshot; otherwise the list entry does (and the
 * list, which always describes the active snapshot, is then checked like any other response).
 */
export function sourceStatusOf(
  metas: readonly AdaptedResponseMeta[],
  pinning: SnapshotPinning,
  snapshots: RawEvidenceSources['snapshots'],
  coverage: RawEvidenceSources['coverage'],
): SourceStatus {
  const first = metas[0];
  if (!first) throw new Error('A passport needs at least one Data Hub response.');
  const pinned = pinning.status === 'PINNED';
  const all = [
    ...metas,
    ...(pinned ? [pinning.detail.meta] : snapshots ? [snapshots.meta] : []),
    ...(coverage ? [coverage.meta] : []),
  ];
  const { dataMode, snapshotId, contentSha256 } = first;
  const consistent = all.every(
    (meta) =>
      meta.dataMode === dataMode && meta.snapshotId === snapshotId && meta.contentSha256 === contentSha256,
  );
  const received = all.map((meta) => meta.clientReceivedAt).sort();
  const snapshotEntry = pinned
    ? pinning.detail.data
    : snapshots?.data.find((entry) => entry.snapshotId === snapshotId);

  return {
    dataMode,
    snapshotId,
    snapshot: snapshotEntry ? toSnapshotDetail(snapshotEntry) : null,
    observedCoverage: coverage
      ? {
          availableIndicators: Object.values(coverage.data.byIndicator).filter((entry) => entry.available)
            .length,
          totalIndicators: coverage.data.totalIndicators,
          regionCoveragePct: coverage.data.regionCoveragePct,
        }
      : null,
    receivedByBrowserAt: received.length > 0 ? (received[received.length - 1] ?? null) : null,
    consistent,
    reproducibility: reproducibilityOf(
      pinning,
      consistent,
      all.map((meta) => meta.contentSha256),
    ),
  };
}

export function buildSourceStatus(raw: RawEvidenceSources): SourceStatus {
  return sourceStatusOf(
    [
      ...raw.profiles.map((envelope) => envelope.meta),
      ...(raw.catalog ? [raw.catalog.meta] : []),
      ...(raw.datasets ? [raw.datasets.meta] : []),
    ],
    raw.pinning,
    raw.snapshots,
    raw.coverage,
  );
}

/**
 * Compares what the link claimed with what the Data Hub returned. The link is only context, so any
 * disagreement is reported and the record must not be presented as the one the link was made from.
 */
export function assessLinkContext(
  link: { readonly mode?: string | null | undefined; readonly snapshotId?: string | null | undefined },
  source: Pick<SourceStatus, 'dataMode' | 'snapshotId'> & Partial<Pick<SourceStatus, 'reproducibility'>>,
): LinkWarning[] {
  const warnings: LinkWarning[] = [];
  if (link.mode && link.mode.toUpperCase() !== source.dataMode) {
    warnings.push({
      code: 'MODE_DIFFERS',
      severity: 'warning',
      message: `Tautan dibuat untuk mode ${link.mode.toUpperCase()}, tetapi data yang diterima berstatus ${source.dataMode}. Catatan ini tidak sama dengan yang dimaksud tautan.`,
    });
  }
  if (!link.snapshotId) {
    const pinned = source.reproducibility?.status === 'REPRODUCIBLE_SNAPSHOT';
    warnings.push({
      code: 'SNAPSHOT_NOT_PINNED',
      severity: 'info',
      message: pinned
        ? `Tautan yang dibuka tidak mencantumkan snapshot, jadi Paspor ini dikunci ke snapshot aktif saat dibuka (${source.snapshotId}). Belum dapat diperiksa apakah itu data yang dilihat pembuat tautan; tautan untuk disalin dan dibagikan sudah mencantumkan snapshot ini.`
        : 'Tautan tidak mencantumkan snapshot, jadi tidak dapat diperiksa apakah data ini sama dengan yang dilihat pembuat tautan.',
    });
  } else if (link.snapshotId !== source.snapshotId) {
    warnings.push({
      code: 'SNAPSHOT_CHANGED',
      severity: 'warning',
      message: `Tautan dibuat saat snapshot ${link.snapshotId}, sedangkan Data Hub kini memberi snapshot ${source.snapshotId}. Angka di bawah berasal dari snapshot ${source.snapshotId} dan dapat berbeda dari yang dilihat pembuat tautan; catatan ini tidak sama dengan tautan.`,
    });
  }
  return warnings;
}

// ---------------------------------------------------------------------------------------------
// Regions and values
// ---------------------------------------------------------------------------------------------

function toEvidenceRegion(profile: RegionProfileDTO): EvidenceRegion {
  const { region } = profile;
  return {
    regionId: region.regionId,
    name: region.displayName,
    levelLabel: adminLevelLabel(region.adminLevel),
    provinceName: region.provinceName,
    codes: region.identifiers.map(({ codeSystem, code }) => ({ system: codeSystem, code })),
    isSyntheticDemoName: region.isSyntheticDemoName,
  };
}

export function nonPlaceholder(value: string, placeholder: string): string | null {
  return value === placeholder ? null : value;
}

function sourceOf(
  item: RegionProfileIndicatorValueDTO,
  catalogItem: DataHubIndicatorDTO | undefined,
  dataset: DataHubDatasetDTO | undefined,
): IndicatorSourceInfo {
  const datasetId = nonPlaceholder(item.provenance.datasetId, UNKNOWN_DATASET);
  const agencyCode =
    nonPlaceholder(item.provenance.agencyCode, UNKNOWN_AGENCY) ?? dataset?.agencyCode ?? null;
  return {
    agencyCode,
    datasetId,
    datasetTitle: dataset?.datasetTitle ?? catalogItem?.provenance.datasetTitle ?? null,
    // Only real web addresses become links; internal:// and anything else is dropped.
    officialUrl:
      publicHttpUrl(item.provenance.officialUrl) ??
      publicHttpUrl(catalogItem?.provenance.officialPortalUrl ?? null) ??
      publicHttpUrl(dataset?.officialPortalUrl ?? null),
  };
}

function toEvidenceValue(
  regionId: string,
  item: RegionProfileIndicatorValueDTO,
  catalogItem: DataHubIndicatorDTO | undefined,
  catalogLoaded: boolean,
  dataset: DataHubDatasetDTO | undefined,
): EvidenceValue {
  const { value } = item;
  const observedMax = observedMaximum(item, catalogItem);
  const unit = describeUnit(item.unit, observedMax);
  const classification =
    value.status === 'AVAILABLE'
      ? classifyEvidence({
          flag: item.qualityFlag,
          isDemoExample: item.isDemoExample,
          catalogAvailability: catalogItem?.availabilityStatus ?? null,
          catalogLoaded,
        })
      : null;
  const numberText = describeObservation(value);
  return {
    regionId,
    status: value.status,
    valueText: value.status === 'AVAILABLE' && unit.label ? `${numberText} ${unit.label}` : numberText,
    rawDecimal: value.status === 'AVAILABLE' ? value.decimal : null,
    evidenceClass: classification?.evidenceClass ?? null,
    rawFlag: item.qualityFlag,
    classNote: classification?.note ?? null,
    referenceYear: item.referenceYear,
    normalizedScore: item.normalizedScoreDecimal,
    source: sourceOf(item, catalogItem, dataset),
  };
}

function observedMaximum(
  item: RegionProfileIndicatorValueDTO,
  catalogItem: DataHubIndicatorDTO | undefined,
): number | null {
  const candidates = [
    item.value.status === 'AVAILABLE' ? Number(item.value.decimal) : Number.NaN,
    catalogItem?.stats?.max ? Number(catalogItem.stats.max) : Number.NaN,
  ].filter((number) => Number.isFinite(number));
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

// ---------------------------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------------------------

function measurementOf(
  item: RegionProfileIndicatorValueDTO | undefined,
  fallbackUnit: string,
): ComparableMeasurement {
  const decimal = item?.value.status === 'AVAILABLE' ? item.value.decimal : null;
  const parsed = decimal === null ? null : Number(decimal);
  return {
    value: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    unit: item?.unit ?? fallbackUnit,
    referenceYear: item?.referenceYear ?? null,
    datasetId: item?.provenance.datasetId ?? '',
    qualityFlag: item?.qualityFlag ?? null,
  };
}

function compareIndicator(
  a: RegionProfileIndicatorValueDTO | undefined,
  b: RegionProfileIndicatorValueDTO | undefined,
  unitLabel: string,
  regionNames: readonly [string, string],
  consistent: boolean,
): ComparisonOutcome {
  if (!consistent) {
    return {
      allowed: false,
      blockers: ['Kedua wilayah berasal dari mode atau snapshot yang berbeda, jadi tidak dibandingkan.'],
      warnings: [],
      differenceText: null,
    };
  }
  const reference = a ?? b;
  const assessment = assessComparison(
    measurementOf(a, reference?.unit ?? ''),
    measurementOf(b, reference?.unit ?? ''),
  );
  let differenceText: string | null = null;
  if (assessment.allowed && assessment.difference) {
    const { absolute, higher } = assessment.difference;
    const amount = `${formatDecimalId(String(Math.abs(absolute)))}${unitLabel ? ` ${unitLabel}` : ''}`;
    differenceText =
      higher === 'EQUAL'
        ? 'Nilai kedua wilayah sama.'
        : `Selisih ${amount}; ${higher === 'A' ? regionNames[0] : regionNames[1]} lebih tinggi.`;
  }
  return {
    allowed: assessment.allowed,
    blockers: assessment.blockers.map((note) => note.message),
    warnings: assessment.warnings.map((note) => note.message),
    differenceText,
  };
}

// ---------------------------------------------------------------------------------------------
// Coverage and missing indicators
// ---------------------------------------------------------------------------------------------

function coverageOf(
  profile: RegionProfileDTO,
  scopeIds: ReadonlySet<string>,
  catalogItems: readonly DataHubIndicatorDTO[] | null,
  requestedIds: readonly string[] | undefined,
  values: readonly EvidenceValue[],
): RegionCoverage {
  const present = new Map(profile.indicators.map((item) => [item.indicatorId, item]));
  const missing: MissingIndicator[] = [];

  for (const item of profile.indicators) {
    if (!scopeIds.has(item.indicatorId) || item.value.status === 'AVAILABLE') continue;
    missing.push({
      indicatorId: item.indicatorId,
      label: item.indicatorName,
      reason: describeObservation(item.value),
    });
  }
  const inScope = (id: string) => requestedIds === undefined || requestedIds.includes(id);
  for (const item of catalogItems ?? []) {
    if (present.has(item.indicatorId) || !inScope(item.indicatorId)) continue;
    missing.push({
      indicatorId: item.indicatorId,
      label: item.labelId,
      reason:
        item.availabilityStatus === 'UNAVAILABLE'
          ? 'Belum ada data resmi untuk indikator ini pada snapshot ini (status katalog: UNAVAILABLE).'
          : 'Tidak ada nilai untuk wilayah ini pada snapshot ini.',
    });
  }
  const known = new Set([...present.keys(), ...(catalogItems ?? []).map((item) => item.indicatorId)]);
  for (const id of requestedIds ?? []) {
    if (!known.has(id)) {
      missing.push({
        indicatorId: id,
        label: id,
        reason: catalogItems
          ? 'Indikator ini tidak dikenal pada snapshot ini.'
          : 'Indikator ini tidak ada pada profil wilayah.',
      });
    }
  }

  const byClass: Partial<Record<EvidenceClass, number>> = {};
  let withValue = 0;
  for (const value of values) {
    if (value.status === 'AVAILABLE') withValue += 1;
    if (value.evidenceClass) byClass[value.evidenceClass] = (byClass[value.evidenceClass] ?? 0) + 1;
  }
  const scopedCatalog = catalogItems?.filter((item) => inScope(item.indicatorId)) ?? null;
  return {
    regionId: profile.region.regionId,
    indicatorsWithValue: withValue,
    indicatorsWithoutValue: missing.length,
    catalogIndicatorCount: scopedCatalog ? scopedCatalog.length : null,
    imputedCount: byClass.IMPUTED_PROVINCE ?? 0,
    byClass,
    missing,
  };
}

// ---------------------------------------------------------------------------------------------
// Source summary
// ---------------------------------------------------------------------------------------------

/** One indicator's use of a source, in a given year. */
export interface SourceUse {
  readonly source: IndicatorSourceInfo;
  readonly year: number | null;
  readonly indicatorId: string;
}

function summariseSources(
  indicators: readonly EvidenceIndicator[],
  datasetsById: ReadonlyMap<string, DataHubDatasetDTO>,
): EvidenceSourceSummary[] {
  return summariseSourceUses(
    indicators.flatMap((indicator) =>
      indicator.values.flatMap((value) =>
        value
          ? [{ source: value.source, year: value.referenceYear, indicatorId: indicator.indicatorId }]
          : [],
      ),
    ),
    datasetsById,
  );
}

/** Groups source uses by dataset and adds what `/datasets` says about each dataset. */
export function summariseSourceUses(
  uses: readonly SourceUse[],
  datasetsById: ReadonlyMap<string, DataHubDatasetDTO>,
): EvidenceSourceSummary[] {
  const groups = new Map<
    string,
    { source: IndicatorSourceInfo; years: Set<number>; indicatorIds: Set<string> }
  >();
  for (const { source, year, indicatorId } of uses) {
    const key = source.datasetId ?? `tanpa-dataset:${source.agencyCode ?? ''}`;
    const group = groups.get(key) ?? { source, years: new Set<number>(), indicatorIds: new Set<string>() };
    if (year !== null) group.years.add(year);
    group.indicatorIds.add(indicatorId);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ source, years, indicatorIds }): EvidenceSourceSummary => {
      const dataset = source.datasetId ? datasetsById.get(source.datasetId) : undefined;
      return {
        datasetId: source.datasetId,
        agencyCode: source.agencyCode,
        datasetTitle: source.datasetTitle,
        officialUrl: source.officialUrl,
        licenseName: dataset?.licenseName ?? null,
        updateFrequency: dataset?.updateFrequency ?? null,
        lastIngestedAt: dataset?.lastIngestedAt ?? null,
        accessMethod: dataset?.accessMethod ?? null,
        years: [...years].sort((x, y) => x - y),
        indicatorCount: indicatorIds.size,
      };
    })
    .sort(
      (x, y) =>
        (x.agencyCode ?? '~').localeCompare(y.agencyCode ?? '~') ||
        (x.datasetId ?? '~').localeCompare(y.datasetId ?? '~'),
    );
}

// ---------------------------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------------------------

/**
 * Assembles one evidence record from Data Hub responses. Pure: the same responses always give the
 * same record. It invents nothing: whatever the responses do not say is `null` or listed as
 * missing, and it adds no identifier, hash or timestamp of its own.
 */
export function buildEvidenceRecord(query: SupportedQuery, raw: RawEvidenceSources): EvidenceRecord {
  const profiles = raw.profiles.map((envelope) => envelope.data);
  const regions = profiles.map(toEvidenceRegion);
  const source = buildSourceStatus(raw);

  const catalogItems = raw.catalog ? raw.catalog.data.items : null;
  const catalogById = new Map((catalogItems ?? []).map((item) => [item.indicatorId, item]));
  const datasetsById = new Map((raw.datasets?.data ?? []).map((dataset) => [dataset.datasetId, dataset]));

  const requestedIds = query.indicatorIds;
  const orderedIds = [
    ...new Set(profiles.flatMap((profile) => profile.indicators.map((item) => item.indicatorId))),
  ];
  const shownIds = requestedIds ? orderedIds.filter((id) => requestedIds.includes(id)) : orderedIds;
  const scopeIds = new Set(shownIds);

  const itemsByProfile = profiles.map(
    (profile) => new Map(profile.indicators.map((item) => [item.indicatorId, item])),
  );
  const regionNames: readonly [string, string] = [
    regions[0]?.name ?? 'Wilayah A',
    regions[1]?.name ?? 'Wilayah B',
  ];

  const indicators = shownIds.map((indicatorId): EvidenceIndicator => {
    const items = itemsByProfile.map((byId) => byId.get(indicatorId));
    const reference = items.find((item) => item !== undefined);
    const catalogItem = catalogById.get(indicatorId);
    const unit = describeUnit(
      reference?.unit ?? '',
      reference ? observedMaximum(reference, catalogItem) : null,
    );
    const label = reference?.indicatorName ?? indicatorId;
    const description = catalogItem?.description.trim() ?? '';
    return {
      indicatorId,
      label,
      category: reference?.category ?? '',
      rawUnit: reference?.unit ?? '',
      unitLabel: unit.label,
      unitWarning: unit.warning,
      definition:
        description && description !== label && description !== catalogItem?.labelId ? description : null,
      derivationFormula: catalogItem?.derivationFormula ?? null,
      polarity: catalogItem?.polarity ?? null,
      values: items.map((item, index) => {
        const regionId = regions[index]?.regionId ?? '';
        if (!item) return null;
        const dataset = datasetsById.get(item.provenance.datasetId);
        return toEvidenceValue(regionId, item, catalogItem, catalogItems !== null, dataset);
      }),
      comparison:
        query.kind === 'bandingkan'
          ? compareIndicator(items[0], items[1], unit.label, regionNames, source.consistent)
          : null,
    };
  });

  const coverage = profiles.map((profile, index) =>
    coverageOf(
      profile,
      scopeIds,
      catalogItems,
      requestedIds,
      indicators.flatMap((indicator) => {
        const value = indicator.values[index];
        return value ? [value] : [];
      }),
    ),
  );

  const unavailableSources = [
    ...(raw.catalog ? [] : ['katalog indikator']),
    ...(raw.datasets ? [] : ['daftar dataset']),
    ...(raw.snapshots || raw.pinning.status === 'PINNED' ? [] : ['daftar snapshot']),
    ...(raw.coverage || raw.requestedMode === 'DEMO' ? [] : ['cakupan indikator (/indicators/coverage)']),
  ];

  const linkWarnings = assessLinkContext(query, source);
  const sources = summariseSources(indicators, datasetsById);
  const title =
    query.kind === 'wilayah'
      ? `Bukti indikator ${regionNames[0]}`
      : `Bukti perbandingan ${regionNames[0]} dan ${regionNames[1]}`;
  const question =
    query.kind === 'wilayah'
      ? `Indikator apa saja yang tercatat untuk ${regionNames[0]}, dari sumber dan tahun apa, dan seberapa jauh nilainya dapat dipercaya?`
      : `Dapatkah ${regionNames[0]} dan ${regionNames[1]} dibandingkan indikator demi indikator, dan berapa selisihnya bila boleh dibandingkan?`;

  const record: EvidenceRecord = {
    kind: query.kind,
    title,
    question,
    source,
    regions,
    coverage,
    indicators,
    sources,
    limitations: [],
    linkWarnings,
    unavailableSources,
    fetched: fetchedForRegions(raw),
  };
  return { ...record, limitations: buildLimitations(record) };
}
