import type {
  AdaptedEnvelope,
  DataHubDatasetDTO,
  DataHubSnapshotDTO,
  DataMode,
  IndicatorCatalogDTO,
  IndicatorCoverageDTO,
  RegionProfileDTO,
} from '@/services/api';
import type { EvidenceClass } from './evidenceClass';

/**
 * Everything the Data Hub answered for one passport, exactly as the adapter decoded it. The builders
 * are pure functions of this, so a record can be rebuilt (and tested) without a network.
 */
export interface RawEvidenceSources {
  /** The mode the requests were made in. The mode SHOWN comes from the envelopes. */
  readonly requestedMode: DataMode;
  /** One profile per region asked for, in the order asked. */
  readonly profiles: readonly AdaptedEnvelope<RegionProfileDTO>[];
  /** `null` = the request failed, which the record reports instead of guessing. */
  readonly catalog: AdaptedEnvelope<IndicatorCatalogDTO> | null;
  readonly datasets: AdaptedEnvelope<readonly DataHubDatasetDTO[]> | null;
  readonly snapshots: AdaptedEnvelope<readonly DataHubSnapshotDTO[]> | null;
  /** `/indicators/coverage`; asked for in LIVE only (DEMO has none). `null` = not asked or failed. */
  readonly coverage: AdaptedEnvelope<IndicatorCoverageDTO> | null;
}

export type LinkWarningCode = 'SNAPSHOT_CHANGED' | 'MODE_DIFFERS' | 'SNAPSHOT_NOT_PINNED';

/** A disagreement (or gap) between what the link claimed and what the Data Hub returned. */
export interface LinkWarning {
  readonly code: LinkWarningCode;
  readonly severity: 'warning' | 'info';
  readonly message: string;
}

export interface SnapshotDetail {
  readonly label: string;
  /** As sent by the server; no time zone is stated, so none is added. */
  readonly createdAt: string | null;
  readonly publishedAt: string | null;
  readonly boundaryVersion: string | null;
  /** The server's own `indicator_completeness_pct` for the snapshot. */
  readonly completenessPct: number | null;
  /**
   * Hex checksum as the server reports it; `null` for placeholders. Never verified in the browser, and
   * NOT a content digest: it stayed identical while the data behind the same snapshot id changed.
   */
  readonly reportedManifestChecksum: string | null;
}

/**
 * What `/indicators/coverage` says about indicator data, kept beside the snapshot's own completeness
 * figure so a contradiction between the two stays visible. Counted from the response; not a new score.
 */
export interface ObservedCoverage {
  readonly availableIndicators: number;
  readonly totalIndicators: number;
}

/** Where the data came from, read from the response envelopes and `/snapshots`, never from the link. */
export interface SourceStatus {
  readonly dataMode: DataMode;
  readonly snapshotId: string;
  readonly snapshot: SnapshotDetail | null;
  /** `/indicators/coverage` as received; `null` = not available (always in DEMO, or the request failed). */
  readonly observedCoverage: ObservedCoverage | null;
  /** When the browser decoded the latest response (the only timestamp this record can claim). */
  readonly receivedByBrowserAt: string | null;
  /** False when the responses disagree on mode or snapshot; the record then refuses to compare. */
  readonly consistent: boolean;
}

export interface EvidenceRegion {
  readonly regionId: string;
  readonly name: string;
  readonly levelLabel: string;
  readonly provinceName: string | null;
  readonly codes: readonly { readonly system: string; readonly code: string }[];
  readonly isSyntheticDemoName: boolean;
}

export interface MissingIndicator {
  readonly indicatorId: string;
  readonly label: string;
  readonly reason: string;
}

/**
 * Completeness (how many indicators have a value) and geographic granularity (whether those values
 * were measured at the region's own level) are two separate facts and are kept apart.
 */
export interface RegionCoverage {
  readonly regionId: string;
  readonly indicatorsWithValue: number;
  readonly indicatorsWithoutValue: number;
  /** Indicators the catalog lists in this snapshot; `null` when the catalog could not be loaded. */
  readonly catalogIndicatorCount: number | null;
  /** Values filled in from a higher level instead of measured for this region. */
  readonly imputedCount: number;
  readonly byClass: Readonly<Partial<Record<EvidenceClass, number>>>;
  readonly missing: readonly MissingIndicator[];
}

export interface IndicatorSourceInfo {
  /** `null` = the Data Hub did not say (shown as "belum tersedia"). */
  readonly agencyCode: string | null;
  readonly datasetId: string | null;
  readonly datasetTitle: string | null;
  /** Only an http(s) address; anything else is dropped, not shown as a link. */
  readonly officialUrl: string | null;
}

export interface EvidenceValue {
  readonly regionId: string;
  readonly status: 'AVAILABLE' | 'MISSING' | 'SUPPRESSED';
  /** Formatted for display; a missing value says so and is never "0". */
  readonly valueText: string;
  readonly rawDecimal: string | null;
  /** `null` when there is no value to classify. */
  readonly evidenceClass: EvidenceClass | null;
  readonly rawFlag: string | null;
  readonly classNote: string | null;
  readonly referenceYear: number | null;
  readonly normalizedScore: string | null;
  readonly source: IndicatorSourceInfo;
}

export interface ComparisonOutcome {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  /** Only for an allowed comparison. */
  readonly differenceText: string | null;
}

export interface EvidenceIndicator {
  readonly indicatorId: string;
  readonly label: string;
  readonly category: string;
  /** The unit string as the Data Hub sent it. */
  readonly rawUnit: string;
  readonly unitLabel: string;
  readonly unitWarning: string | null;
  /** `null` when the catalog gives no definition beyond the name. */
  readonly definition: string | null;
  readonly derivationFormula: string | null;
  readonly polarity: string | null;
  /** One entry per region of the record, in order; `null` = the region has no entry for it. */
  readonly values: readonly (EvidenceValue | null)[];
  /** Comparison records only. */
  readonly comparison: ComparisonOutcome | null;
}

/** One dataset behind the record, with what the Data Hub says about it. */
export interface EvidenceSourceSummary {
  readonly datasetId: string | null;
  readonly agencyCode: string | null;
  readonly datasetTitle: string | null;
  readonly officialUrl: string | null;
  readonly licenseName: string | null;
  readonly updateFrequency: string | null;
  /** When the Data Hub loaded the dataset (not when the publisher released it). */
  readonly lastIngestedAt: string | null;
  readonly accessMethod: string | null;
  readonly years: readonly number[];
  readonly indicatorCount: number;
}

/** What every kind of record (region, comparison, composite) carries, so the shared sections render any. */
export interface EvidenceBase {
  readonly title: string;
  readonly question: string;
  readonly source: SourceStatus;
  readonly sources: readonly EvidenceSourceSummary[];
  readonly limitations: readonly string[];
  readonly linkWarnings: readonly LinkWarning[];
  /** The responses this record was assembled from, with the request that made each. */
  readonly fetched: readonly FetchedResponse[];
  /** Supporting requests that failed ("katalog indikator", ...), so the gap is stated. */
  readonly unavailableSources: readonly string[];
}

export interface EvidenceRecord extends EvidenceBase {
  readonly kind: 'wilayah' | 'bandingkan';
  readonly regions: readonly EvidenceRegion[];
  readonly coverage: readonly RegionCoverage[];
  readonly indicators: readonly EvidenceIndicator[];
}

/**
 * One Data Hub response as the browser received it. Built from the request parameters this page sent
 * (no host, no credentials) and the envelope the Data Hub answered with. Nothing here is computed
 * by the browser except the request description; the receive time is the browser's own clock.
 */
export interface FetchedResponse {
  /** What was asked for, e.g. `region-detail:1101`. */
  readonly resource: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  /** JSON body of a POST; `null` for a GET. */
  readonly body: Readonly<Record<string, unknown>> | null;
  /** Mode and snapshot id exactly as the envelope stated them. */
  readonly mode: DataMode;
  readonly snapshotId: string;
  readonly boundaryVersion: string | null;
  /** When the browser decoded this response (browser clock). */
  readonly receivedByBrowserAt: string;
  /** Only if the server sent an `X-Request-ID`; never invented. */
  readonly serverRequestId: string | null;
}
