// Nusa Matra Data Hub adapter.

import { ApiError } from './apiError';
import type { HttpResponseContext } from './httpClient';
import type {
  AdaptedEnvelope,
  AdaptedResponseMeta,
  AdminLevel,
  BoundaryCollectionDTO,
  BoundaryFeatureDTO,
  BoundaryGeometryStatusDTO,
  BoundingBox4,
  DataHubDatasetDTO,
  DataHubIndicatorDTO,
  DataHubRegionDTO,
  DataHubSnapshotDTO,
  DataMode,
  DecimalString,
  ExploratoryCompositeResultDTO,
  ExploratoryRegionRankDTO,
  GeoAnchorPointDTO,
  IndicatorCatalogDTO,
  IndicatorSummaryStatsDTO,
  IndicatorValuesMapDTO,
  ObservationDTO,
  ObservationValue,
  Origin,
  PreferredDirection,
  ReferencePeriod,
  RegionCompositeScoresSummaryDTO,
  RegionIdentifierDTO,
  RegionIndicatorMeasurementDTO,
  RegionProfileDTO,
  RegionProfileIndicatorValueDTO,
  SourceCitation,
  SystemHealthDTO,
  WeightedCriterionInput,
} from './wireTypes';

const VALID_SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;
const VALID_DECIMAL_REGEX = /^-?\d+(\.\d+)?$/;
const SYNTHETIC_DEMO_NAME_REGEX = /\bdemo\b/i;

// ============================================================================
// 1. Envelope & Health Decoders (SOURCE 4 Errata #1, #2, #3, #10)
// ============================================================================

/**
 * Validates the standard FastAPI `{ status, meta, data }` envelope.
 * - Rejects non-success `status`.
 * - Enforces strict `DEMO` / `LIVE` isolation (`API-INV-01`).
 * - Never fabricates a `serverRequestId` or `serverGeneratedAt` (`SOURCE 4` Errata #1 & #2).
 */
export function mapEnvelope<TDomain>(
  raw: unknown,
  expectedMode: DataMode,
  context: HttpResponseContext,
  transformData: (data: unknown, meta: AdaptedResponseMeta) => TDomain,
): AdaptedEnvelope<TDomain> {
  if (!isRecord(raw)) {
    throw new ApiError(
      context.status || 500,
      'MALFORMED_ENVELOPE',
      context.requestId,
      'network.unavailable',
      { serverMessage: 'Response body is not a JSON object' },
    );
  }

  // Handle top-level error object if server accidentally returned HTTP 200 with status="error"
  if (raw.status !== 'success') {
    const errCode = readString(raw.code) ?? 'APPLICATION_ERROR_STATUS';
    const errMsg = readString(raw.message) ?? `Envelope status "${String(raw.status)}"`;
    throw new ApiError(
      context.status || 500,
      errCode,
      context.requestId,
      errCode === 'LIVE_UNAVAILABLE' ? 'data.live_unavailable' : 'network.unavailable',
      { serverMessage: errMsg },
    );
  }

  if (!isRecord(raw.meta)) {
    throw new ApiError(
      context.status || 500,
      'MALFORMED_ENVELOPE',
      context.requestId,
      'network.unavailable',
      { serverMessage: 'Response envelope is missing required "meta" object' },
    );
  }

  if (!('data' in raw)) {
    throw new ApiError(
      context.status || 500,
      'MALFORMED_ENVELOPE',
      context.requestId,
      'network.unavailable',
      { serverMessage: 'Response envelope is missing required "data" property' },
    );
  }

  const wireMode = readDataMode(raw.meta.mode);
  if (!wireMode) {
    throw new ApiError(500, 'INVALID_SERVER_MODE', context.requestId, 'network.unavailable', {
      serverMessage: `Invalid or missing meta.mode: "${String(raw.meta.mode)}"`,
    });
  }

  // API-INV-01: Never allow DEMO payload to satisfy a LIVE request or vice versa
  if (wireMode !== expectedMode) {
    throw new ApiError(
      409,
      'MODE_MISMATCH',
      context.requestId,
      expectedMode === 'LIVE' ? 'data.live_unavailable' : 'data.demo_disclaimer',
      {
        serverMessage: `Mode mismatch: requested ${expectedMode}, received ${wireMode}`,
      },
    );
  }

  const snapshotId = readString(raw.meta.snapshot_id);
  if (!snapshotId) {
    throw new ApiError(500, 'MISSING_SNAPSHOT_ID', context.requestId, 'network.unavailable', {
      serverMessage: 'Response meta.snapshot_id is missing or empty',
    });
  }

  const adaptedMeta: AdaptedResponseMeta = {
    serverRequestId: context.requestId,
    apiVersion: 'v1',
    serverGeneratedAt: null,
    clientReceivedAt: context.clientReceivedAt,
    dataMode: wireMode,
    snapshotId,
    boundaryVersion: readString(raw.meta.boundary_version),
    totalCount: readIntegerOrNull(raw.meta.total_count),
  };

  const mappedData = transformData(raw.data, adaptedMeta);

  return {
    data: mappedData,
    meta: adaptedMeta,
  };
}

/**
 * Decodes `GET /api/v1/health` which returns `HealthResponse` directly without `ApiResponse` wrapper.
 */
export function mapHealthResponse(raw: unknown, context: HttpResponseContext): SystemHealthDTO {
  if (!isRecord(raw)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', context.requestId, 'network.unavailable', {
      serverMessage: 'Health response is not a JSON object',
    });
  }

  const status = readString(raw.status);
  const version = readString(raw.version);
  const dataMode = readDataMode(raw.mode);
  const activeSnapshotId = readString(raw.active_snapshot);

  if (!status || !version || !dataMode || !activeSnapshotId || !isRecord(raw.database)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', context.requestId, 'network.unavailable', {
      serverMessage: 'Health response is missing required core fields',
    });
  }

  const dbStatus = readString(raw.database.status) ?? 'unknown';
  let tables: Record<string, number> | null = null;
  if (isRecord(raw.database.tables)) {
    tables = {};
    for (const [tableName, countVal] of Object.entries(raw.database.tables)) {
      const parsedCount = readIntegerOrNull(countVal);
      if (parsedCount !== null) {
        tables[tableName] = parsedCount;
      }
    }
  }

  return {
    status,
    version,
    dataMode,
    activeSnapshotId,
    database: {
      status: dbStatus,
      tables,
      detail: readString(raw.database.detail),
    },
    redis: readString(raw.redis),
    staticFallbackReady: typeof raw.static_fallback_ready === 'boolean' ? raw.static_fallback_ready : false,
    clientReceivedAt: context.clientReceivedAt,
  };
}

// ============================================================================
// 2. Numeric & Observation Value Decoder (API-INV-03)
// ============================================================================

/**
 * Converts a raw backend observation value into `ObservationValue`.
 * API-INV-03: NEVER serialize missing/null as "0"; measured 0 is valid AVAILABLE "0".
 */
export function mapRawObservationValue(rawValue: unknown, qualityFlag?: string | null): ObservationValue {
  if (qualityFlag === 'SUPPRESSED') {
    return {
      status: 'SUPPRESSED',
      decimal: null,
      reasonCode: 'PUBLISHER_SUPPRESSION',
    };
  }

  if (rawValue === null || rawValue === undefined || qualityFlag === 'MISSING') {
    return {
      status: 'MISSING',
      decimal: null,
      reasonCode: 'NOT_PUBLISHED',
    };
  }

  const decimal = parseDecimalString(rawValue, 'observation value');
  return {
    status: 'AVAILABLE',
    decimal,
  };
}

export function parseDecimalString(rawValue: unknown, fieldName = 'numeric field'): DecimalString {
  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) {
      throw new Error(`Rejected non-finite number for ${fieldName}`);
    }
    return String(rawValue);
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!VALID_DECIMAL_REGEX.test(trimmed)) {
      throw new Error(
        `Invalid decimal string for ${fieldName}: "${trimmed}" (locale commas or non-numeric characters are forbidden)`,
      );
    }
    return trimmed;
  }

  throw new Error(`Unsupported value type for ${fieldName}: ${typeof rawValue}`);
}

export function parseOptionalDecimalString(rawValue: unknown): DecimalString | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  return parseDecimalString(rawValue);
}

// ============================================================================
// 3. Region Catalog & Region Detail Mappers (regions_nonempty.json & region_detail.json)
// ============================================================================

/**
 * Maps frontend AdminLevel filter to backend GET /api/v1/regions `level` query param.
 * Note: FastAPI v0.1.0 only accepts `kabupaten_kota | provinsi | all`.
 */
export function toBackendRegionLevelQuery(adminLevel?: AdminLevel): 'provinsi' | 'kabupaten_kota' | 'all' {
  if (adminLevel === 'PROVINCE') return 'provinsi';
  if (adminLevel === 'REGENCY' || adminLevel === 'CITY') return 'kabupaten_kota';
  return 'kabupaten_kota';
}

/**
 * Maps a raw region item (`regions_nonempty.json` or `region_detail.json -> data.region`)
 * into `DataHubRegionDTO`.
 * Never alters synthetic DEMO names ("Kabupaten Demo Jabar 1").
 */
export function mapWireRegionItem(raw: unknown, meta: AdaptedResponseMeta): DataHubRegionDTO {
  if (!isRecord(raw)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Region item is not an object',
    });
  }

  const regionId = readString(raw.region_id);
  const name = readString(raw.name);
  const rawLevel = readString(raw.level);
  if (!rawLevel) {
    throw new Error('Region level is missing; refusing to guess REGENCY');
  }

  if (!regionId || !name) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Region item is missing region_id or name',
    });
  }

  if (meta.dataMode === 'LIVE' && SYNTHETIC_DEMO_NAME_REGEX.test(name)) {
    throw new ApiError(409, 'MODE_MISMATCH', meta.serverRequestId, 'data.live_unavailable', {
      serverMessage: 'Synthetic DEMO region in LIVE payload',
    });
  }
  const adminLevel = mapWireAdminLevel(rawLevel);
  const boundaryEditionId = meta.boundaryVersion ?? 'UNVERIFIED_DEMO_BOUNDARY';

  const identifiers: RegionIdentifierDTO[] = [];
  if (isRecord(raw.codes)) {
    for (const [codeSystem, codeVal] of Object.entries(raw.codes)) {
      const cleanCode = readString(codeVal);
      if (cleanCode) {
        identifiers.push({
          codeSystem,
          code: cleanCode,
          boundaryEditionId,
        });
      }
    }
  }

  let anchorPoint: GeoAnchorPointDTO | null = null;
  if (isRecord(raw.anchor_point)) {
    const lng = readFiniteNumberOrNull(raw.anchor_point.lng);
    const lat = readFiniteNumberOrNull(raw.anchor_point.lat);
    if (lng !== null && lat !== null) {
      anchorPoint = { lng, lat };
    }
  }

  return {
    regionId,
    nameId: name, // Legacy alias; this is a literal display label, NOT an i18n key.
    displayName: name,
    adminLevel,
    parentRegionId: readString(raw.parent_region_id),
    identifiers,
    shortName: readString(raw.short_name),
    provinceName: readString(raw.province_name),
    islandGroup: readString(raw.island_group),
    areaKm2: readFiniteNumberOrNull(raw.area_km2),
    anchorPoint,
    bbox: parseBoundingBox4(raw.bbox),
    rawLevel,
    isSyntheticDemoName: meta.dataMode === 'DEMO' || SYNTHETIC_DEMO_NAME_REGEX.test(name),
  };
}

export function mapRegionsListData(
  rawData: unknown,
  meta: AdaptedResponseMeta,
  filterAdminLevel?: AdminLevel,
): readonly DataHubRegionDTO[] {
  if (!Array.isArray(rawData)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Expected data to be an array of regions',
    });
  }

  const mapped = rawData.map((item) => mapWireRegionItem(item, meta));

  // If the caller specifically asked for REGENCY or CITY, filter the combined kabupaten_kota response
  if (filterAdminLevel === 'REGENCY' || filterAdminLevel === 'CITY') {
    return mapped.filter((region) => region.adminLevel === filterAdminLevel);
  }

  return mapped;
}

/**
 * Maps `GET /api/v1/regions/{region_id}` (`region_detail.json`).
 */
export function mapRegionDetailData(rawData: unknown, meta: AdaptedResponseMeta): RegionProfileDTO {
  if (!isRecord(rawData) || !isRecord(rawData.region)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Region detail payload is missing "region" object',
    });
  }

  const region = mapWireRegionItem(rawData.region, meta);

  let compositeScores: RegionCompositeScoresSummaryDTO | null = null;
  if (isRecord(rawData.composite_scores)) {
    const cs = rawData.composite_scores;
    compositeScores = {
      overallPriorityIndex: parseOptionalDecimalString(cs.overall_priority_index),
      disasterRisk: parseOptionalDecimalString(cs.disaster_risk),
      socioeconomic: parseOptionalDecimalString(cs.socioeconomic),
      educationAccess: parseOptionalDecimalString(cs.education_access),
      healthcareAccess: parseOptionalDecimalString(cs.healthcare_access),
      infrastructure: parseOptionalDecimalString(cs.infrastructure),
      dataReliability: parseOptionalDecimalString(cs.data_reliability),
    };
  }

  const rawIndicators = Array.isArray(rawData.indicators) ? rawData.indicators : [];

  const indicators: RegionProfileIndicatorValueDTO[] = rawIndicators.map((item) =>
    mapRegionProfileIndicator(item, region.regionId, meta),
  );

  return {
    region,
    compositeScores,
    indicators,
    dataMode: meta.dataMode,
    snapshotId: meta.snapshotId,
  };
}

function mapRegionProfileIndicator(
  raw: unknown,
  regionId: string,
  meta: AdaptedResponseMeta,
): RegionProfileIndicatorValueDTO {
  if (!isRecord(raw)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Region indicator entry is not an object',
    });
  }

  const indicatorId = readString(raw.indicator_id);
  const indicatorName = readString(raw.indicator_name);
  const category = readString(raw.category) ?? 'uncategorized';
  const unit = readString(raw.unit) ?? '';

  if (!indicatorId || !indicatorName) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Region indicator entry is missing indicator_id or indicator_name',
    });
  }

  const qualityFlag = readString(raw.quality_flag);
  rejectDemoExampleInLive(meta, qualityFlag);
  const isDemoExample = qualityFlag === 'DEMO_EXAMPLE' || meta.dataMode === 'DEMO';
  const origin: Origin = isDemoExample ? 'DEMO' : 'SOURCE_REPORTED';
  const value = mapRawObservationValue(raw.raw_value, qualityFlag);
  const referenceYear = readIntegerOrNull(raw.reference_year);

  const provRecord = isRecord(raw.provenance) ? raw.provenance : {};
  const datasetId = readString(provRecord.dataset_id) ?? 'unknown_dataset';
  const agencyCode = readString(provRecord.agency_code) ?? 'UNKNOWN_AGENCY';
  const officialUrl = readString(provRecord.official_url) ?? readString(provRecord.official_portal_url);

  const period = buildYearReferencePeriod(referenceYear);
  const boundaryEditionId = meta.boundaryVersion ?? 'UNVERIFIED_DEMO_BOUNDARY';
  const qualityIssueCodes = qualityFlag ? [qualityFlag] : [];

  const source: SourceCitation = {
    publisherId: agencyCode,
    publisherName: isDemoExample ? `${agencyCode} (Simulasi DEMO — bukan observasi resmi)` : agencyCode,
    datasetId,
    datasetEditionId: `${datasetId}:${meta.snapshotId}`,
    publicSourceUrl: officialUrl,
    licenseLabel: isDemoExample ? 'DEMO_EXAMPLE' : null,
    retrievedAt: null,
    publishedAt: null,
  };

  const observation: ObservationDTO = {
    observationId: `${meta.snapshotId}:${regionId}:${indicatorId}`,
    regionId,
    indicatorId,
    methodologyId: `UNVERIFIED_DEMO_METHOD:${indicatorId}`,
    comparabilityGroupId: null,
    period,
    result: value,
    origin,
    unitCode: unit,
    boundaryEditionId,
    source,
    qualityIssueCodes,
  };

  return {
    indicatorId,
    indicatorName,
    category,
    value,
    unit,
    normalizedScoreDecimal: parseOptionalDecimalString(raw.normalized_score),
    nationalPercentileDecimal: parseOptionalDecimalString(raw.national_percentile),
    nationalRank: readIntegerOrNull(raw.national_rank),
    referenceYear,
    qualityFlag,
    isDemoExample,
    origin,
    provenance: {
      datasetId,
      agencyCode,
      officialUrl,
    },
    observation,
  };
}

// ============================================================================
// 4. Indicator Catalog & Indicator Values Mappers (indicators.json & indicator_values.json)
// ============================================================================

export function mapWireIndicatorItem(
  raw: unknown,
  fallbackCategory: string,
  meta: AdaptedResponseMeta,
): DataHubIndicatorDTO {
  if (!isRecord(raw)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Indicator item is not an object',
    });
  }

  const indicatorId = readString(raw.indicator_id);
  const indicatorName = readString(raw.indicator_name);
  if (!indicatorId || !indicatorName) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Indicator item is missing indicator_id or indicator_name',
    });
  }

  const category = readString(raw.category) ?? fallbackCategory;
  const unit = readString(raw.unit) ?? '';
  const polarity = readString(raw.polarity) ?? 'unknown';
  const availabilityStatus = readString(raw.availability_status) ?? 'UNKNOWN';
  const derivationFormula = readString(raw.derivation_formula);
  const description = readString(raw.description) ?? indicatorName;
  const referenceYear = readIntegerOrNull(raw.reference_year);

  const preferredDirection = mapPolarityToPreferredDirection(polarity);

  let stats: IndicatorSummaryStatsDTO | null = null;
  if (isRecord(raw.stats)) {
    stats = {
      min: parseOptionalDecimalString(raw.stats.min),
      p25: parseOptionalDecimalString(raw.stats.p25),
      median: parseOptionalDecimalString(raw.stats.median),
      mean: parseOptionalDecimalString(raw.stats.mean),
      p75: parseOptionalDecimalString(raw.stats.p75),
      max: parseOptionalDecimalString(raw.stats.max),
    };
  }

  const prov = isRecord(raw.provenance) ? raw.provenance : {};
  const datasetId = readString(prov.dataset_id) ?? 'unknown_dataset';
  const agencyCode = readString(prov.agency_code) ?? 'UNKNOWN_AGENCY';
  const datasetTitle = readString(prov.dataset_title);
  const officialPortalUrl = readString(prov.official_portal_url) ?? readString(prov.official_url);

  return {
    indicatorId,
    labelId: indicatorName,
    definitionId: description,
    unitCode: unit,
    unitLabelId: unit,
    preferredDirection,
    methodologyIds: [], // Actual methodology IDs are not supplied by Data Hub v0.1.0.
    category,
    description,
    polarity,
    availabilityStatus,
    derivationFormula,
    referenceYear,
    stats,
    provenance: {
      datasetId,
      agencyCode,
      datasetTitle,
      officialPortalUrl,
    },
  };
}

/**
 * Maps `GET /api/v1/indicators` (`indicators.json`), which returns a dictionary
 * grouped by category (`data_reliability`, `disaster_risk`, etc.).
 */
export function mapIndicatorCatalogData(rawData: unknown, meta: AdaptedResponseMeta): IndicatorCatalogDTO {
  if (!isRecord(rawData)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Expected indicator catalog data to be a category-keyed object',
    });
  }

  const items: DataHubIndicatorDTO[] = [];
  const byCategory: Record<string, DataHubIndicatorDTO[]> = {};
  const categories: string[] = [];

  for (const [categoryKey, groupValue] of Object.entries(rawData)) {
    if (!Array.isArray(groupValue)) {
      continue;
    }
    categories.push(categoryKey);
    const mappedGroup = groupValue.map((entry) => mapWireIndicatorItem(entry, categoryKey, meta));
    byCategory[categoryKey] = mappedGroup;
    items.push(...mappedGroup);
  }

  return {
    items,
    byCategory,
    categories,
  };
}

/**
 * Maps `GET /api/v1/indicators/{indicator_id}/values` (`indicator_values.json`).
 * Preserves string `region_id` keys (`"1101"`, `"3201"`), keeps `raw: 0` distinct from `null`,
 * and preserves `flag: "DEMO_EXAMPLE"`.
 */
export function mapIndicatorValuesData(rawData: unknown, meta: AdaptedResponseMeta): IndicatorValuesMapDTO {
  if (!isRecord(rawData) || !isRecord(rawData.indicator) || !isRecord(rawData.values_by_region)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Indicator values payload must contain "indicator" and "values_by_region" objects',
    });
  }

  const indicator = mapWireIndicatorItem(rawData.indicator, 'uncategorized', meta);
  const period = buildYearReferencePeriod(indicator.referenceYear);
  const boundaryEditionId = meta.boundaryVersion ?? 'UNVERIFIED_DEMO_BOUNDARY';

  const valuesByRegion: Record<string, RegionIndicatorMeasurementDTO> = {};
  const observations: ObservationDTO[] = [];

  for (const [regionId, rawCell] of Object.entries(rawData.values_by_region)) {
    if (!isRecord(rawCell)) {
      continue;
    }

    const qualityFlag = readString(rawCell.flag);
    rejectDemoExampleInLive(meta, qualityFlag);
    const isDemoExample = qualityFlag === 'DEMO_EXAMPLE' || meta.dataMode === 'DEMO';
    const origin: Origin = isDemoExample
      ? 'DEMO'
      : indicator.availabilityStatus === 'DERIVED'
        ? 'DERIVED'
        : 'SOURCE_REPORTED';

    const value = mapRawObservationValue(rawCell.raw, qualityFlag);

    const measurement: RegionIndicatorMeasurementDTO = {
      regionId,
      value,
      normalizedScoreDecimal: parseOptionalDecimalString(rawCell.norm),
      percentileDecimal: parseOptionalDecimalString(rawCell.pct),
      rank: readIntegerOrNull(rawCell.rank),
      qualityFlag,
      isDemoExample,
      origin,
    };

    valuesByRegion[regionId] = measurement;

    const source: SourceCitation = {
      publisherId: indicator.provenance.agencyCode,
      publisherName: isDemoExample
        ? `${indicator.provenance.agencyCode} (Simulasi DEMO — bukan observasi resmi)`
        : indicator.provenance.agencyCode,
      datasetId: indicator.provenance.datasetId,
      datasetEditionId: `${indicator.provenance.datasetId}:${meta.snapshotId}`,
      publicSourceUrl: indicator.provenance.officialPortalUrl,
      licenseLabel: isDemoExample ? 'DEMO_EXAMPLE' : null,
      retrievedAt: null,
      publishedAt: null,
    };

    observations.push({
      observationId: `${meta.snapshotId}:${regionId}:${indicator.indicatorId}`,
      regionId,
      indicatorId: indicator.indicatorId,
      methodologyId: `UNVERIFIED_DEMO_METHOD:${indicator.indicatorId}`,
      comparabilityGroupId: null,
      period,
      result: value,
      origin,
      unitCode: indicator.unitCode,
      boundaryEditionId,
      source,
      qualityIssueCodes: qualityFlag ? [qualityFlag] : [],
    });
  }

  return {
    indicator,
    valuesByRegion,
    observations,
    dataMode: meta.dataMode,
    snapshotId: meta.snapshotId,
  };
}

// ============================================================================
// 5. Lab Prioritas Composite Scoring Validation & Mapper (composite_valid.json)
// ============================================================================

/**
 * Validates and converts UI weight criteria into FastAPI `weights: Record<string, number>`.
 * Enforces:
 * - Non-empty criteria list
 * - No duplicate `indicatorId`
 * - Each `basisPoints` is a safe integer in `[0, 10000]`
 * -At least one criterion has `basisPoints > 0`
 * - Total sum equals exactly `10000`
 */
export function validateAndBuildCompositeWeights(
  criteria: readonly WeightedCriterionInput[],
): Record<string, number> {
  if (criteria.length === 0) {
    throw new ApiError(422, 'WEIGHTS_INVALID', null, 'analysis.weights_invalid', {
      serverMessage: 'Criteria list must contain at least one indicator',
    });
  }

  const weights: Record<string, number> = {};
  let sum = 0;

  for (const item of criteria) {
    const id = item.indicatorId.trim();
    if (!id) {
      throw new ApiError(422, 'WEIGHTS_INVALID', null, 'analysis.weights_invalid', {
        serverMessage: 'Criterion indicatorId must be a non-empty string',
      });
    }

    if (Object.prototype.hasOwnProperty.call(weights, id)) {
      throw new ApiError(422, 'WEIGHTS_INVALID', null, 'analysis.weights_invalid', {
        serverMessage: `Duplicate indicatorId in composite query: "${id}"`,
      });
    }

    const bps = item.basisPoints;
    if (typeof bps !== 'number' || !Number.isInteger(bps) || bps < 0 || bps > 10000) {
      throw new ApiError(422, 'WEIGHTS_INVALID', null, 'analysis.weights_invalid', {
        serverMessage: `Basis points for "${id}" must be an integer between 0 and 10000, received: ${String(bps)}`,
      });
    }

    if (bps > 0) {
      weights[id] = bps;
      sum += bps;
    }
  }

  if (sum !== 10000) {
    throw new ApiError(422, 'WEIGHT_SUM_INVALID', null, 'analysis.weight_sum_invalid', {
      serverMessage: `Weights must sum to 10000 basis points, got ${sum}`,
    });
  }

  return weights;
}

/**
 * Maps `POST /api/v1/indicators/composite-query` (`composite_valid.json`).
 * Explicitly marks `runId: null`, `isExploratoryPreview: true`, and
 * `weightedContributionsAvailable: false` (ARGON_RUNTIME_CONTRACT.md Blocker #5).
 */
function readBasisPointRecord(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const weights: Record<string, number> = {};
  for (const [indicatorId, bps] of Object.entries(value)) {
    const parsed = readIntegerOrNull(bps);
    if (parsed !== null) weights[indicatorId] = parsed;
  }
  return weights;
}

export function mapCompositeQueryData(
  rawData: unknown,
  meta: AdaptedResponseMeta,
  filterProvinceId: string | null = null,
): ExploratoryCompositeResultDTO {
  if (!isRecord(rawData) || !Array.isArray(rawData.regions)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Composite query payload must contain a "regions" array',
    });
  }

  const totalRegions = readIntegerOrNull(rawData.total_regions) ?? rawData.regions.length;

  const weightsBasisPoints = readBasisPointRecord(rawData.weights_basis_points) ?? {};
  // Guide v2 provenance of the redistribution; absent fields stay null (not reported), never assumed.
  const unavailable = rawData.unavailable_indicators;
  const unavailableIndicatorIds = Array.isArray(unavailable)
    ? unavailable.filter((id): id is string => typeof id === 'string')
    : null;

  const items: ExploratoryRegionRankDTO[] = rawData.regions.map((row) => {
    if (!isRecord(row)) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Composite region row is not an object',
      });
    }

    const regionId = readString(row.region_id);
    const regionNameId = readString(row.region_name);
    if (meta.dataMode === 'LIVE' && regionNameId && SYNTHETIC_DEMO_NAME_REGEX.test(regionNameId)) {
      throw new ApiError(409, 'MODE_MISMATCH', meta.serverRequestId, 'data.live_unavailable', {
        serverMessage: 'Synthetic DEMO ranking in LIVE payload',
      });
    }
    const rankPosition = readIntegerOrNull(row.rank);

    if (!regionId || !regionNameId) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Composite region row is missing region_id, region_name, composite_score, or rank',
      });
    }

    const compositeScoreDecimal = parseOptionalDecimalString(row.composite_score);
    if ((rankPosition === null) !== (compositeScoreDecimal === null)) {
      throw new Error('Composite result must block both rank and score together');
    }

    const componentScoresDecimal: Record<string, DecimalString | null> = {};
    if (isRecord(row.component_scores)) {
      for (const [indId, compVal] of Object.entries(row.component_scores)) {
        componentScoresDecimal[indId] = parseOptionalDecimalString(compVal);
      }
    }

    return {
      regionId,
      regionNameId,
      regionDisplayName: regionNameId,
      compositeScoreDecimal,
      rankPosition,
      componentScoresDecimal,
    };
  });

  return {
    runId: null,
    isExploratoryPreview: true,
    weightedContributionsAvailable: false,
    contributions: null,
    dataMode: meta.dataMode,
    snapshotId: meta.snapshotId,
    totalRegions,
    weightsBasisPoints,
    renormalized: typeof rawData.renormalized === 'boolean' ? rawData.renormalized : null,
    unavailableIndicatorIds,
    effectiveWeightsBasisPoints: readBasisPointRecord(rawData.effective_weights),
    filterProvinceId,
    items,
  };
}

// ============================================================================
// 6. Boundaries Mapper (boundaries_kabupaten.json — Point-Only Guard)
// ============================================================================

/**
 * Maps `GET /api/v1/boundaries/kabupaten` or `/provinsi` (`boundaries_kabupaten.json`).
 * Enforces `canExtrudePolygons: false` when `geometry_available` is `false` or
 * features are `Point` centroids rather than `Polygon`/`MultiPolygon`.
 */
export function mapBoundariesData(rawData: unknown, meta: AdaptedResponseMeta): BoundaryCollectionDTO {
  if (
    !isRecord(rawData) ||
    rawData.type !== 'FeatureCollection' ||
    !Array.isArray(rawData.features) ||
    !isRecord(rawData.geometry_status)
  ) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Boundaries payload must be a FeatureCollection with geometry_status',
    });
  }

  const gs = rawData.geometry_status;
  const geometryAvailable = gs.geometry_available === true;
  const geometryTypeReturned = readString(gs.geometry_type_returned);
  const source = readString(gs.source) ?? 'UNKNOWN';
  const boundaryVersion = readString(gs.boundary_version) ?? meta.boundaryVersion;
  const gsMode = readBoundaryDataMode(gs.data_mode);
  if (!gsMode || gsMode !== meta.dataMode) {
    throw new ApiError(
      409,
      'MODE_MISMATCH',
      meta.serverRequestId,
      meta.dataMode === 'LIVE' ? 'data.live_unavailable' : 'data.demo_disclaimer',
      { serverMessage: 'Boundary geometry mode conflicts with response envelope' },
    );
  }
  const note = readString(gs.note);

  const features: BoundaryFeatureDTO[] = rawData.features.map((feat) => {
    if (!isRecord(feat) || !isRecord(feat.properties)) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Invalid GeoJSON feature in boundaries payload',
      });
    }

    const props = feat.properties;
    const regionId = readString(props.region_id) ?? '';
    const name = readString(props.name) ?? '';

    let geometry: BoundaryFeatureDTO['geometry'] = null;
    if (isRecord(feat.geometry) && typeof feat.geometry.type === 'string') {
      geometry = {
        type: feat.geometry.type,
        coordinates: feat.geometry.coordinates,
      };
    }

    return {
      type: 'Feature',
      properties: {
        regionId,
        parentRegionId: readString(props.parent_region_id),
        name,
        kemendagriCode: readString(props.kemendagri_code),
        bpsCode: readString(props.bps_code),
        labelLng: readFiniteNumberOrNull(props.label_lng),
        labelLat: readFiniteNumberOrNull(props.label_lat),
      },
      geometry,
      bbox: parseBoundingBox4(feat.bbox),
    };
  });

  const hasValidPolygonFeatures =
    features.length > 0 &&
    features.every(
      (f) =>
        f.geometry !== null &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        Array.isArray(f.geometry.coordinates) &&
        f.geometry.coordinates.length > 0,
    );

  const canExtrudePolygons = geometryAvailable && source !== 'DEMO_PLACEHOLDER' && hasValidPolygonFeatures;

  const geometryStatus: BoundaryGeometryStatusDTO = {
    geometryAvailable,
    geometryTypeReturned,
    source,
    boundaryVersion,
    dataMode: gsMode,
    note,
    canExtrudePolygons,
  };

  const reqParams = isRecord(rawData.request_params) ? rawData.request_params : {};

  return {
    type: 'FeatureCollection',
    features,
    geometryStatus,
    requestParams: {
      format: readString(reqParams.format) ?? 'geojson',
      resolution: readString(reqParams.resolution),
    },
  };
}

// ============================================================================
// 7. Snapshots & Datasets Mappers (snapshots.json & datasets.json)
// ============================================================================

/**
 * Maps `GET /api/v1/snapshots` (`snapshots.json`).
 * Flags non-hexadecimal `manifest_checksum` values (e.g., `"d3m0..."`) as placeholders
 * and sets `verifiedDigestSha256: null` (ARGON_RUNTIME_CONTRACT.md Blocker #7).
 */
export function mapSnapshotsData(rawData: unknown, meta: AdaptedResponseMeta): readonly DataHubSnapshotDTO[] {
  if (!Array.isArray(rawData)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Expected snapshots data to be an array',
    });
  }

  return rawData.map((item) => {
    if (!isRecord(item)) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Snapshot entry is not an object',
      });
    }

    const snapshotId = readString(item.snapshot_id);
    const label = readString(item.label);
    const envTag = readDataMode(item.environment_tag) ?? meta.dataMode;
    const rawChecksum = readString(item.manifest_checksum) ?? '';

    if (!snapshotId || !label) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Snapshot entry is missing snapshot_id or label',
      });
    }

    const isValidHexSha256 = VALID_SHA256_HEX_REGEX.test(rawChecksum);

    return {
      snapshotId,
      label,
      dataMode: envTag,
      isActiveDefault: item.is_active_default === true,
      boundaryVersion: readString(item.boundary_version),
      createdAt: readString(item.created_at) ?? '',
      publishedAt: readString(item.published_at) ?? '',
      verifiedDigestSha256: null, // Valid hex syntax alone does not prove digest integrity.
      checksumSyntaxValid: isValidHexSha256,
      rawManifestChecksum: rawChecksum,
      isChecksumPlaceholder: !isValidHexSha256,
      notes: readString(item.notes),
      indicatorCompletenessPct: readFiniteNumberOrNull(item.indicator_completeness_pct),
    };
  });
}

/**
 * Maps `GET /api/v1/datasets` (`datasets.json`).
 * Flags `"demo_placeholder_000..."` `raw_sha256` values so they are never treated as verified digests.
 */
export function mapDatasetsData(rawData: unknown, meta: AdaptedResponseMeta): readonly DataHubDatasetDTO[] {
  if (!Array.isArray(rawData)) {
    throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
      serverMessage: 'Expected datasets data to be an array',
    });
  }

  return rawData.map((item) => {
    if (!isRecord(item)) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Dataset entry is not an object',
      });
    }

    const datasetId = readString(item.dataset_id);
    const agencyCode = readString(item.agency_code);
    const agencyName = readString(item.agency_name);
    const datasetTitle = readString(item.dataset_title);
    const rawChecksum = readString(item.raw_sha256) ?? '';

    if (!datasetId || !agencyCode || !agencyName || !datasetTitle) {
      throw new ApiError(500, 'MALFORMED_ENVELOPE', meta.serverRequestId, 'network.unavailable', {
        serverMessage: 'Dataset entry is missing required identifier fields',
      });
    }

    const isValidHexSha256 = VALID_SHA256_HEX_REGEX.test(rawChecksum);

    return {
      datasetId,
      agencyCode,
      agencyName,
      datasetTitle,
      officialPortalUrl: readString(item.official_portal_url),
      apiOrDownloadUrl: readString(item.api_or_download_url),
      accessMethod: readString(item.access_method) ?? 'UNKNOWN',
      licenseName: readString(item.license_name),
      updateFrequency: readString(item.update_frequency),
      lastIngestedAt: readString(item.last_ingested_at),
      verifiedSha256: null, // Requires recomputation against the archived source payload.
      checksumSyntaxValid: isValidHexSha256,
      rawChecksum,
      isChecksumPlaceholder: !isValidHexSha256,
    };
  });
}

// ============================================================================
// 8. Internal Helpers
// ============================================================================

function mapWireAdminLevel(rawLevel: string): AdminLevel {
  const normalized = rawLevel.toLowerCase().trim();
  if (normalized === 'provinsi' || normalized === 'province') {
    return 'PROVINCE';
  }
  if (normalized === 'kota' || normalized === 'city') {
    return 'CITY';
  }
  if (normalized === 'kabupaten' || normalized === 'regency') {
    return 'REGENCY';
  }
  throw new Error(`Unknown administrative level in backend payload: ${rawLevel}`);
}

function mapPolarityToPreferredDirection(polarity: string): PreferredDirection {
  const norm = polarity.toLowerCase().trim();
  if (norm === 'positive') return 'HIGHER_IS_BETTER';
  if (norm === 'negative') return 'HIGHER_IS_WORSE';
  if (norm === 'contextual') return 'CONTEXTUAL';
  return 'UNAPPROVED';
}

function buildYearReferencePeriod(year: number | null): ReferencePeriod {
  if (year !== null && year >= 1900 && year <= 2100) {
    return {
      periodId: `year:${year}`,
      label: String(year),
      granularity: 'YEAR',
      startsOn: `${year}-01-01`,
      endsBefore: `${year + 1}-01-01`,
    };
  }
  return {
    periodId: 'period:unspecified',
    label: 'Periode belum tersedia',
    granularity: 'UNKNOWN',
    startsOn: null,
    endsBefore: null,
  };
}

function parseBoundingBox4(rawBbox: unknown): BoundingBox4 | null {
  if (!Array.isArray(rawBbox) || rawBbox.length !== 4) {
    return null;
  }
  const n0 = readFiniteNumberOrNull(rawBbox[0]);
  const n1 = readFiniteNumberOrNull(rawBbox[1]);
  const n2 = readFiniteNumberOrNull(rawBbox[2]);
  const n3 = readFiniteNumberOrNull(rawBbox[3]);
  if (n0 === null || n1 === null || n2 === null || n3 === null) {
    return null;
  }
  return [n0, n1, n2, n3];
}

/** Fail closed even when envelope meta.mode says LIVE but individual records reveal DEMO fixtures. */
function rejectDemoExampleInLive(meta: AdaptedResponseMeta, flag: string | null): void {
  if (meta.dataMode === 'LIVE' && flag === 'DEMO_EXAMPLE') {
    throw new ApiError(409, 'MODE_MISMATCH', meta.serverRequestId, 'data.live_unavailable', {
      serverMessage: 'DEMO_EXAMPLE observation in LIVE payload',
    });
  }
}

/**
 * The boundary endpoint labels official geometry `REAL_OFFICIAL` instead of `LIVE`. That label
 * counts as LIVE and nothing else does, so the comparison with the envelope's mode still rejects
 * any other value.
 */
function readBoundaryDataMode(value: unknown): DataMode | null {
  if (typeof value === 'string' && value.trim().toUpperCase() === 'REAL_OFFICIAL') return 'LIVE';
  return readDataMode(value);
}

function readDataMode(value: unknown): DataMode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'DEMO' || upper === 'LIVE') {
    return upper;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
