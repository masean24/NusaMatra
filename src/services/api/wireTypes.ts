// Nusa Matra Data Hub adapter.
/**
 * Exact wire-level types verified against:
 * 1. Captured runtime JSON payloads in ARGON_RUNTIME_CONTRACT.md, regions_nonempty.json, datasets.json
 * 2. Exported FastAPI OpenAPI v0.1.0 (openapi.json)
 * 3. Frontend proposed canonical types (docs/08-API-SPECIFICATION.md)
 */

// ============================================================================
// 1. Canonical Domain Types (from docs/08-API-SPECIFICATION.md Section 4)
// ============================================================================

export type DataMode = 'DEMO' | 'LIVE';
export type SnapshotStatus = 'PUBLISHED' | 'RETIRED';
export type AdminLevel = 'PROVINCE' | 'REGENCY' | 'CITY';
export type ValueStatus = 'AVAILABLE' | 'MISSING' | 'SUPPRESSED';
export type Origin = 'SOURCE_REPORTED' | 'DERIVED' | 'DEMO';
export type QualitySeverity = 'INFO' | 'WARNING' | 'BLOCKED';
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type DecimalString = string;
export type ResourceId = string;

export interface ReferencePeriod {
  readonly periodId: ResourceId;
  readonly label: string;
  readonly granularity: 'YEAR' | 'QUARTER' | 'MONTH' | 'AS_OF' | 'UNKNOWN';
  readonly startsOn: string | null;
  readonly endsBefore: string | null;
}

export type ObservationValue =
  | { readonly status: 'AVAILABLE'; readonly decimal: DecimalString }
  | {
      readonly status: 'MISSING';
      readonly decimal: null;
      readonly reasonCode: string;
    }
  | {
      readonly status: 'SUPPRESSED';
      readonly decimal: null;
      readonly reasonCode: string;
    };

export interface SourceCitation {
  readonly publisherId: ResourceId;
  readonly publisherName: string;
  readonly datasetId: ResourceId;
  readonly datasetEditionId: ResourceId;
  readonly publicSourceUrl: string | null;
  readonly licenseLabel: string | null;
  readonly retrievedAt: string | null;
  readonly publishedAt: string | null;
}

export interface RegionIdentifierDTO {
  readonly codeSystem: string;
  readonly code: string;
  readonly boundaryEditionId: ResourceId;
}

export interface RegionDTO {
  readonly regionId: ResourceId;
  readonly nameId: string;
  readonly adminLevel: AdminLevel;
  readonly parentRegionId: ResourceId | null;
  readonly identifiers: readonly RegionIdentifierDTO[];
}

export type PreferredDirection = 'HIGHER_IS_WORSE' | 'HIGHER_IS_BETTER' | 'CONTEXTUAL' | 'UNAPPROVED';

export interface IndicatorDTO {
  readonly indicatorId: ResourceId;
  readonly labelId: string;
  readonly definitionId: string;
  readonly unitCode: string;
  readonly unitLabelId: string;
  readonly preferredDirection: PreferredDirection;
  readonly methodologyIds: readonly ResourceId[];
  readonly category: string;
}

export interface ObservationDTO {
  readonly observationId: ResourceId;
  readonly regionId: ResourceId;
  readonly indicatorId: ResourceId;
  readonly methodologyId: ResourceId;
  readonly comparabilityGroupId: ResourceId | null;
  readonly period: ReferencePeriod;
  readonly result: ObservationValue;
  readonly origin: Origin;
  readonly unitCode: string;
  readonly boundaryEditionId: ResourceId;
  readonly source: SourceCitation;
  readonly qualityIssueCodes: readonly string[];
}

// ============================================================================
// 2. Adapted Domain Extensions for Observed v0.1.0 Data Hub Payloads
// ============================================================================

export interface AdaptedResponseMeta {
  /** Null unless server returned X-Request-ID header (SOURCE 4 Errata #1) */
  readonly serverRequestId: string | null;
  readonly apiVersion: 'v1';
  /** Null unless server explicitly sent a generation timestamp (SOURCE 4 Errata #2) */
  readonly serverGeneratedAt: string | null;
  /** Client-side decode timestamp, never confused with publisher/snapshot time */
  readonly clientReceivedAt: string;
  readonly dataMode: DataMode;
  readonly snapshotId: string;
  readonly boundaryVersion: string | null;
  readonly totalCount: number | null;
  /**
   * v2.2 `content_sha256`: the Data Hub's own digest of the snapshot content (64 hex). Reported by the
   * server and never recomputed in the browser. `null` = not sent (DEMO, legacy snapshots, v2.1).
   */
  readonly contentSha256: string | null;
  /** v2.2 `snapshot_immutable`; `null` = not reported. */
  readonly snapshotImmutable: boolean | null;
  /** v2.2 `snapshot_reproducible`; `null` = not reported. */
  readonly snapshotReproducible: boolean | null;
  readonly methodologyVersion: string | null;
}

/** The snapshot a request is pinned to (`?snapshot=`), with the digest every response must repeat. */
export interface SnapshotPin {
  readonly snapshotId: string;
  readonly contentSha256: string;
}

export interface AdaptedEnvelope<TData> {
  readonly data: TData;
  readonly meta: AdaptedResponseMeta;
}

export interface GeoAnchorPointDTO {
  readonly lng: number;
  readonly lat: number;
}

export type BoundingBox4 = readonly [number, number, number, number];

/**
 * Extends canonical RegionDTO with the extra spatial and display fields
 * actually returned by GET /api/v1/regions and GET /api/v1/regions/{region_id}.
 */
export interface DataHubRegionDTO extends RegionDTO {
  /** Literal region label from backend; `nameId` is a legacy alias, not a translation key. */
  readonly displayName: string;
  readonly shortName: string | null;
  readonly provinceName: string | null;
  readonly islandGroup: string | null;
  readonly areaKm2: number | null;
  readonly anchorPoint: GeoAnchorPointDTO | null;
  readonly bbox: BoundingBox4 | null;
  readonly rawLevel: string;
  readonly isSyntheticDemoName: boolean;
}

export interface RegionCompositeScoresSummaryDTO {
  readonly overallPriorityIndex: DecimalString | null;
  readonly disasterRisk: DecimalString | null;
  readonly socioeconomic: DecimalString | null;
  readonly educationAccess: DecimalString | null;
  readonly healthcareAccess: DecimalString | null;
  readonly infrastructure: DecimalString | null;
  readonly dataReliability: DecimalString | null;
}

export interface RegionProfileIndicatorValueDTO {
  readonly indicatorId: string;
  readonly indicatorName: string;
  readonly category: string;
  readonly value: ObservationValue;
  readonly unit: string;
  readonly normalizedScoreDecimal: DecimalString | null;
  readonly nationalPercentileDecimal: DecimalString | null;
  readonly nationalRank: number | null;
  readonly referenceYear: number | null;
  readonly qualityFlag: string | null;
  readonly isDemoExample: boolean;
  readonly origin: Origin;
  readonly provenance: {
    readonly datasetId: string;
    readonly agencyCode: string;
    readonly officialUrl: string | null;
  };
  /** Canonical ObservationDTO representation for seamless integration with existing hooks */
  readonly observation: ObservationDTO;
}

export interface RegionProfileDTO {
  readonly region: DataHubRegionDTO;
  readonly compositeScores: RegionCompositeScoresSummaryDTO | null;
  readonly indicators: readonly RegionProfileIndicatorValueDTO[];
  readonly dataMode: DataMode;
  readonly snapshotId: string;
}

export interface IndicatorSummaryStatsDTO {
  readonly min: DecimalString | null;
  readonly p25: DecimalString | null;
  readonly median: DecimalString | null;
  readonly mean: DecimalString | null;
  readonly p75: DecimalString | null;
  readonly max: DecimalString | null;
}

export interface DataHubIndicatorDTO extends IndicatorDTO {
  readonly description: string;
  /** Backend vocabulary: "positive" | "negative" | "contextual" (open set). */
  readonly polarity: string;
  /** Backend vocabulary: "DIRECT" | "DERIVED" (open set). */
  readonly availabilityStatus: string;
  readonly derivationFormula: string | null;
  readonly referenceYear: number | null;
  readonly stats: IndicatorSummaryStatsDTO | null;
  readonly provenance: {
    readonly datasetId: string;
    readonly agencyCode: string;
    readonly datasetTitle: string | null;
    readonly officialPortalUrl: string | null;
  };
}

export interface IndicatorCatalogDTO {
  readonly items: readonly DataHubIndicatorDTO[];
  readonly byCategory: Readonly<Record<string, readonly DataHubIndicatorDTO[]>>;
  readonly categories: readonly string[];
}

export interface RegionIndicatorMeasurementDTO {
  readonly regionId: string;
  readonly value: ObservationValue;
  readonly normalizedScoreDecimal: DecimalString | null;
  readonly percentileDecimal: DecimalString | null;
  readonly rank: number | null;
  readonly qualityFlag: string | null;
  readonly isDemoExample: boolean;
  readonly origin: Origin;
  /** v2.2: dataset of THIS observation (may differ from the indicator's catalog dataset); `null` = not sent. */
  readonly datasetId: string | null;
  /** v2.2: the source row this observation came from, as the Data Hub names it; `null` = not sent. */
  readonly sourceRecordRef: string | null;
}

export interface IndicatorValuesMapDTO {
  readonly indicator: DataHubIndicatorDTO;
  readonly valuesByRegion: Readonly<Record<string, RegionIndicatorMeasurementDTO>>;
  readonly observations: readonly ObservationDTO[];
  readonly dataMode: DataMode;
  readonly snapshotId: string;
}

export interface WeightedCriterionInput {
  readonly indicatorId: string;
  readonly basisPoints: number;
}

/**
 * Per-region quality flag as the Data Hub reports it for one component (`quality_flags[indicator]`).
 * Kept as the raw vocabulary string: `VERIFIED`, `IMPUTED_PROVINCE` (value estimated at province level,
 * NOT a kabupaten/kota measurement) and, in DEMO, `DEMO_EXAMPLE`. Unknown values are passed through,
 * never translated into a better-sounding one.
 */
export type ComponentQualityFlag = string;

export interface ExploratoryRegionRankDTO {
  readonly regionId: string;
  /** This is a literal backend label rather than a translation key. */
  readonly regionNameId: string;
  readonly regionDisplayName: string;
  readonly compositeScoreDecimal: DecimalString | null;
  /**
   * Rank within the RETURNED list (filter-scoped), exactly as the Data Hub sent it: rank 1 is the
   * highest intervention need (`score_direction: higher_is_need`); equal scores share a rank
   * (1, 1, 3). Never recomputed by the frontend.
   */
  readonly rankPosition: number | null;
  /** Position among all nationally eligible regions (Guide v2.1 `national_rank`); `null` = not reported. */
  readonly nationalRank: number | null;
  /**
   * Share (0-100) of the nationally available effective weight this region has data for
   * (`coverage_pct`). PER-REGION data completeness. Not the same as the share of the user's REQUESTED
   * weight that has national data (see `requestedWeightAvailabilityPct` in the integrity assessment).
   * `null` = not reported.
   */
  readonly coveragePct: number | null;
  /** Indicators this region's score is built from (`components_used`); `null` = not reported (v1). */
  readonly componentsUsed: readonly string[] | null;
  /** Nationally available indicators this region has no value for (`missing_indicators`); `null` = not reported. */
  readonly missingIndicators: readonly string[] | null;
  /**
   * Weights, in basis points summing to 10 000, over `componentsUsed` only (`effective_weights_region`).
   * The score is reconstructed with THESE, never with the global effective weights. `null` = not reported (v1).
   */
  readonly effectiveWeightsRegion: Readonly<Record<string, number>> | null;
  /** Quality flag per used component (`quality_flags`); `null` = not reported (v1). */
  readonly qualityFlags: Readonly<Record<string, ComponentQualityFlag>> | null;
  /**
   * Normalized 0-100 score per criterion; higher = higher need. `null` = no observation (missing),
   * a genuine `"0"` is a valid observed value.
   * WARNING: These are unweighted component scores, NOT weighted contributions summing to compositeScore.
   */
  readonly componentScoresDecimal: Readonly<Record<string, DecimalString | null>>;
}

/**
 * A region the Data Hub could not rank (`insufficient_data[]`): coverage below the threshold or fewer
 * than the minimum components. It has no score and no rank, and must never be given one.
 */
export interface InsufficientRegionDTO {
  readonly regionId: string;
  readonly regionNameId: string;
  readonly regionDisplayName: string;
  /** Per-region coverage (0-100) that fell short; `null` = not reported. */
  readonly coveragePct: number | null;
  readonly componentsUsed: readonly string[];
  readonly missingIndicators: readonly string[];
  readonly componentScoresDecimal: Readonly<Record<string, DecimalString | null>>;
  /** Backend reason code, e.g. `COVERAGE_BELOW_THRESHOLD`. */
  readonly reason: string;
}

export interface ExploratoryCompositeResultDTO {
  /** Always null in v0.1.0 because POST /indicators/composite-query does not persist a run */
  readonly runId: null;
  readonly isExploratoryPreview: true;
  /** Always false in v0.1.0 because component_scores are unweighted normalized values */
  readonly weightedContributionsAvailable: false;
  readonly contributions: null;
  readonly dataMode: DataMode;
  readonly snapshotId: string;
  /** Count of regions in `items` as the Data Hub states it (`total_regions`); filter-scoped, NOT 514. */
  readonly totalRegions: number;
  /**
   * What a higher score means (`score_direction`). The only accepted value is `higher_is_need`:
   * higher = higher intervention priority, rank 1 = highest need. `null` = not reported (v1 response).
   */
  readonly scoreDirection: string | null;
  /** Nationally eligible regions for this weight set (`total_eligible_national`); `null` = not reported. */
  readonly totalEligibleNational: number | null;
  /** Regions left out as insufficient data (`total_excluded`); `null` = not reported. */
  readonly totalExcluded: number | null;
  /** Backend per-region coverage threshold, in percent (`min_coverage_pct`); `null` = not reported. */
  readonly minCoveragePct: number | null;
  /** Backend minimum observed components per region (`min_components`); `null` = not reported. */
  readonly minComponents: number | null;
  /** The weights the request sent, as the Data Hub echoes them (`weights_basis_points`). */
  readonly weightsBasisPoints: Readonly<Record<string, number>>;
  /**
   * Guide v2: whether weights of indicators without data in this mode were redistributed over the
   * others (`renormalized`). `null` when the response does not say (v1 responses).
   */
  readonly renormalized: boolean | null;
  /** Guide v2: weighted indicators left out because the mode holds no data for them (NATIONAL availability). */
  readonly unavailableIndicatorIds: readonly string[] | null;
  /** Guide v2: the GLOBAL weights actually used (`effective_weights`); `null` when not reported. Per-region weights are on each item. */
  readonly effectiveWeightsBasisPoints: Readonly<Record<string, number>> | null;
  /** The province the request was limited to, if any. */
  readonly filterProvinceId: string | null;
  /** Ranked regions, in the order the Data Hub returned them. */
  readonly items: readonly ExploratoryRegionRankDTO[];
  /** Regions the Data Hub declined to rank. Empty when none, or when the response does not report them (v1). */
  readonly insufficient: readonly InsufficientRegionDTO[];
  /**
   * v2.2 `rankable`: the Data Hub's own verdict that this weight set may be ranked at all. `false` comes
   * with no regions and a `notRankableReason`; `null` = not reported (v2.1 and older).
   */
  readonly rankable: boolean | null;
  /** v2.2 `not_rankable_reason`, verbatim (English, from the Data Hub); `null` when rankable or not sent. */
  readonly notRankableReason: string | null;
  /** v2.2: share (0-100) of the REQUESTED weight on indicators with national observations. */
  readonly nationalCoveragePct: number | null;
  /** v2.2: requested basis points that fall on indicators with national observations. */
  readonly availableWeightBasisPoints: number | null;
  /** v2.2: weighted indicators with national observations; `null` = not reported. */
  readonly availableIndicatorIds: readonly string[] | null;
}

export interface BoundaryGeometryStatusDTO {
  readonly geometryAvailable: boolean;
  /** GeoJSON type name as returned: "Point" for the DEMO placeholder, later "Polygon" | "MultiPolygon". */
  readonly geometryTypeReturned: string | null;
  readonly source: string;
  readonly boundaryVersion: string | null;
  readonly dataMode: DataMode;
  readonly note: string | null;
  /**
   * True ONLY when geometryAvailable is true AND features contain Polygon or MultiPolygon coordinates.
   * Always false for the v0.1.0 DEMO Point-only placeholder payload.
   */
  readonly canExtrudePolygons: boolean;
}

export interface BoundaryFeaturePropertiesDTO {
  readonly regionId: string;
  readonly parentRegionId: string | null;
  readonly name: string;
  readonly kemendagriCode: string | null;
  readonly bpsCode: string | null;
  readonly labelLng: number | null;
  readonly labelLat: number | null;
}

export interface BoundaryFeatureDTO {
  readonly type: 'Feature';
  readonly properties: BoundaryFeaturePropertiesDTO;
  readonly geometry: {
    readonly type: string;
    readonly coordinates: unknown;
  } | null;
  readonly bbox: BoundingBox4 | null;
}

export interface BoundaryCollectionDTO {
  readonly type: 'FeatureCollection';
  readonly features: readonly BoundaryFeatureDTO[];
  readonly geometryStatus: BoundaryGeometryStatusDTO;
  readonly requestParams: {
    readonly format: string;
    readonly resolution: string | null;
  };
}

export interface DataHubSnapshotDTO {
  readonly snapshotId: string;
  readonly label: string;
  readonly dataMode: DataMode;
  readonly isActiveDefault: boolean;
  readonly boundaryVersion: string | null;
  readonly createdAt: string;
  readonly publishedAt: string;
  /** Null when manifest_checksum is not a valid 64-char hex SHA-256 (e.g., "d3m0...") */
  readonly verifiedDigestSha256: string | null;
  /** Hex format only, not a cryptographic verification. */
  readonly checksumSyntaxValid: boolean;
  readonly rawManifestChecksum: string;
  readonly isChecksumPlaceholder: boolean;
  readonly notes: string | null;
  readonly indicatorCompletenessPct: number | null;
  /** v2.2: digest of the snapshot content (64 hex) as the server states it; `null` = not sent. */
  readonly contentSha256: string | null;
  /** v2.2 `is_immutable` / `is_reproducible`; `false` when not stated (never assumed true). */
  readonly isImmutable: boolean;
  readonly isReproducible: boolean;
}

/** v2.2 `GET /api/v1/snapshots/{id}`: the full metadata of one snapshot, as the server states it. */
export interface SnapshotDetailDTO extends DataHubSnapshotDTO {
  /** Catalog, region, dataset and scoring metadata only; NOT a digest of the observations. */
  readonly metadataChecksum: string | null;
  readonly contentHashSpec: string | null;
  readonly methodologyVersion: string | null;
  readonly referencePeriods: readonly number[];
  readonly supersedes: string | null;
  readonly observationCount: number | null;
  readonly indicatorCount: number | null;
  readonly availableIndicatorCount: number | null;
  readonly availableIndicatorDataPct: number | null;
  readonly regionCount: number | null;
  readonly regionCoveragePct: number | null;
  readonly datasetCount: number | null;
  readonly immutabilityNote: string | null;
}

export interface DataHubDatasetDTO {
  readonly datasetId: string;
  readonly agencyCode: string;
  readonly agencyName: string;
  readonly datasetTitle: string;
  readonly officialPortalUrl: string | null;
  readonly apiOrDownloadUrl: string | null;
  readonly accessMethod: string;
  readonly licenseName: string | null;
  readonly updateFrequency: string | null;
  readonly lastIngestedAt: string | null;
  /** Null when raw_sha256 is a DEMO placeholder ("demo_placeholder_000...") */
  readonly verifiedSha256: string | null;
  /** Hex format only, not a cryptographic verification. */
  readonly checksumSyntaxValid: boolean;
  readonly rawChecksum: string;
  readonly isChecksumPlaceholder: boolean;
}

export interface SystemHealthDTO {
  readonly status: string;
  readonly version: string;
  readonly dataMode: DataMode;
  readonly activeSnapshotId: string;
  readonly database: {
    readonly status: string;
    readonly tables: Readonly<Record<string, number>> | null;
    readonly detail: string | null;
  };
  readonly redis: string | null;
  readonly staticFallbackReady: boolean;
  readonly clientReceivedAt: string;
}

// ============================================================================
// 3. Raw Wire Payloads (Exact snake_case shapes from captured JSON files)
// ============================================================================

export interface WireResponseMeta {
  snapshot_id: string;
  mode: string;
  boundary_version?: string | null;
  total_count?: number | null;
}

export interface WireApiResponse<TData = unknown> {
  status?: string;
  meta: WireResponseMeta;
  data: TData;
}

export interface WireHealthResponse {
  status: string;
  version: string;
  mode: string;
  active_snapshot: string;
  database: {
    status: string;
    tables?: Record<string, number> | null;
    detail?: string | null;
  };
  redis?: string | null;
  static_fallback_ready?: boolean;
}

export interface WireRegionCodes {
  kemendagri?: string | null;
  bps?: string | null;
  kemendikdasmen?: string | null;
  [key: string]: string | null | undefined;
}

export interface WireAnchorPoint {
  lng: number;
  lat: number;
}

export interface WireRegionItem {
  region_id: string;
  parent_region_id?: string | null;
  province_name?: string | null;
  level: string;
  name: string;
  short_name?: string | null;
  codes?: WireRegionCodes | null;
  island_group?: string | null;
  area_km2?: number | null;
  anchor_point?: WireAnchorPoint | null;
  bbox?: number[] | null;
}

export interface WireRegionIndicatorProvenance {
  dataset_id: string;
  agency_code: string;
  official_url?: string | null;
  official_portal_url?: string | null;
}

export interface WireRegionProfileIndicator {
  indicator_id: string;
  indicator_name: string;
  category: string;
  raw_value: number | string | null;
  unit: string;
  normalized_score?: number | string | null;
  national_percentile?: number | string | null;
  national_rank?: number | null;
  reference_year?: number | null;
  quality_flag?: string | null;
  provenance?: WireRegionIndicatorProvenance | null;
}

export interface WireRegionDetailData {
  region: WireRegionItem;
  composite_scores?: Record<string, number | string | null> | null;
  indicators: WireRegionProfileIndicator[];
}

export interface WireIndicatorStats {
  min?: number | string | null;
  p25?: number | string | null;
  median?: number | string | null;
  mean?: number | string | null;
  p75?: number | string | null;
  max?: number | string | null;
}

export interface WireIndicatorProvenance {
  dataset_id: string;
  agency_code: string;
  dataset_title?: string | null;
  official_portal_url?: string | null;
  official_url?: string | null;
}

export interface WireIndicatorCatalogItem {
  indicator_id: string;
  indicator_name: string;
  category: string;
  unit: string;
  polarity: string;
  availability_status: string;
  derivation_formula?: string | null;
  description?: string | null;
  reference_year?: number | null;
  stats?: WireIndicatorStats | null;
  provenance?: WireIndicatorProvenance | null;
}

export type WireIndicatorsGroupedData = Record<string, WireIndicatorCatalogItem[]>;

export interface WireRegionValueCell {
  raw: number | string | null;
  norm?: number | string | null;
  pct?: number | string | null;
  rank?: number | null;
  flag?: string | null;
}

export interface WireIndicatorValuesData {
  indicator: WireIndicatorCatalogItem;
  values_by_region: Record<string, WireRegionValueCell>;
}

export interface WireCompositeQueryRequest {
  weights: Record<string, number>;
  filter_province_id?: string | null;
}

export interface WireCompositeRegionRow {
  region_id: string;
  region_name: string;
  composite_score: number | string;
  rank: number;
  national_rank?: number | null;
  coverage_pct?: number | null;
  components_used?: string[] | null;
  missing_indicators?: string[] | null;
  effective_weights_region?: Record<string, number> | null;
  quality_flags?: Record<string, string> | null;
  component_scores?: Record<string, number | string | null> | null;
}

export interface WireInsufficientRegionRow {
  region_id: string;
  region_name: string;
  coverage_pct?: number | null;
  components_used?: string[] | null;
  missing_indicators?: string[] | null;
  component_scores?: Record<string, number | string | null> | null;
  reason: string;
}

export interface WireCompositeQueryData {
  total_regions: number;
  total_eligible_national?: number | null;
  total_excluded?: number | null;
  score_direction?: string | null;
  min_coverage_pct?: number | null;
  min_components?: number | null;
  weights_basis_points: Record<string, number>;
  unavailable_indicators?: string[] | null;
  effective_weights?: Record<string, number> | null;
  renormalized?: boolean | null;
  regions: WireCompositeRegionRow[];
  insufficient_data?: WireInsufficientRegionRow[] | null;
}

export interface WireBoundaryGeometryStatus {
  geometry_available: boolean;
  geometry_type_returned?: string | null;
  source: string;
  boundary_version?: string | null;
  data_mode: string;
  note?: string | null;
}

export interface WireBoundaryFeature {
  type: 'Feature';
  properties: {
    region_id: string;
    parent_region_id?: string | null;
    name: string;
    kemendagri_code?: string | null;
    bps_code?: string | null;
    label_lng?: number | null;
    label_lat?: number | null;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  bbox?: number[] | null;
}

export interface WireBoundariesData {
  type: 'FeatureCollection';
  features: WireBoundaryFeature[];
  geometry_status: WireBoundaryGeometryStatus;
  request_params?: {
    format?: string;
    resolution?: string | null;
  };
}

export interface WireSnapshotItem {
  snapshot_id: string;
  label: string;
  environment_tag: string;
  is_active_default: boolean;
  boundary_version?: string | null;
  created_at: string;
  published_at: string;
  manifest_checksum: string;
  notes?: string | null;
  indicator_completeness_pct?: number | null;
}

export interface WireDatasetItem {
  dataset_id: string;
  agency_code: string;
  agency_name: string;
  dataset_title: string;
  official_portal_url?: string | null;
  api_or_download_url?: string | null;
  access_method: string;
  license_name?: string | null;
  update_frequency?: string | null;
  last_ingested_at?: string | null;
  raw_sha256: string;
}
