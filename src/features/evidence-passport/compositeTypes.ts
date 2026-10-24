import type {
  AdaptedEnvelope,
  CompositePresetsDTO,
  DataHubDatasetDTO,
  DataHubRegionDTO,
  DataHubSnapshotDTO,
  DataMode,
  ExploratoryCompositeResultDTO,
  IndicatorCatalogDTO,
  IndicatorCoverageDTO,
  IndicatorValuesMapDTO,
} from '@/services/api';
import type { CompositeIssueCode } from '@/domain/prioritization';
import type { EvidenceClass } from './evidenceClass';
import type { EvidenceBase, IndicatorSourceInfo } from './evidenceTypes';

/** A published score that does not follow its raw value (a known inconsistency, not missing evidence). */
export interface DirectionAnomalyView {
  readonly indicatorId: string;
  readonly regionId: string;
  readonly raw: number;
  readonly score: number;
}

export interface CompositeDirectionReview {
  /** False in DEMO: nothing was checked against a source. */
  readonly checked: boolean;
  /** Known inconsistencies the ranking can reach. */
  readonly anomalies: readonly DirectionAnomalyView[];
  /** Indicators whose independent observations go against the indicator's direction. */
  readonly inconsistentIndicatorIds: readonly string[];
  /** National ranks are left out: an affected region outside the province filter is ranked with them. */
  readonly nationalRankWithheld: boolean;
  /** Indicators whose direction could not be fully verified (insufficient evidence or values not loaded). */
  readonly notFullyVerifiedIndicatorIds: readonly string[];
}

/** The Data Hub's answers for one Lab passport, as the adapter decoded them. */
export interface RawCompositeSources {
  readonly requestedMode: DataMode;
  /** Required: without it there is nothing to record. */
  readonly composite: AdaptedEnvelope<ExploratoryCompositeResultDTO>;
  /** `null` = could not be loaded; then the preset verdict is unknown, which is not "rankable". */
  readonly presets: AdaptedEnvelope<CompositePresetsDTO> | null;
  readonly catalog: AdaptedEnvelope<IndicatorCatalogDTO> | null;
  readonly datasets: AdaptedEnvelope<readonly DataHubDatasetDTO[]> | null;
  readonly snapshots: AdaptedEnvelope<readonly DataHubSnapshotDTO[]> | null;
  /** `/indicators/coverage`; asked for in LIVE only (DEMO has none). `null` = not asked or failed. */
  readonly coverage: AdaptedEnvelope<IndicatorCoverageDTO> | null;
  /** The region registry, asked for only to name a province filter; `null` = not asked or not loaded. */
  readonly regions: AdaptedEnvelope<readonly DataHubRegionDTO[]> | null;
  /**
   * LIVE only: the published values of each weighted indicator, to check the ranking's component scores
   * against their raw values (the same rule as Lab Prioritas). `null` = DEMO or not asked; an entry
   * `null` = that indicator could not be loaded, so its direction is not verified.
   */
  readonly indicatorValues: Readonly<Record<string, AdaptedEnvelope<IndicatorValuesMapDTO> | null>> | null;
}

/** Who made a rule: the Data Hub, or Nusa Matra's own interface policy. Never blurred. */
export type IssueOrigin = 'datahub' | 'policy' | 'check';

export interface CompositeIssueView {
  readonly code: CompositeIssueCode;
  readonly severity: 'block' | 'disclose';
  /** Plain Indonesian, from the integrity check. */
  readonly message: string;
  readonly origin: IssueOrigin;
  /** Label of the origin, e.g. "Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub)". */
  readonly originLabel: string;
  readonly count: number;
  readonly examples: readonly string[];
}

/** Coverage tier of a ranked region, from the server's own `coverage_pct`. */
export type CoverageTierView = 'complete' | 'partial' | 'insufficient' | 'unreported';

/** One criterion of one region: what the Data Hub sent, nothing recomputed. */
export interface RegionComponent {
  readonly indicatorId: string;
  readonly label: string;
  /** "tidak tersedia" for null; a genuine zero stays "0". */
  readonly scoreText: string;
  /** The component score exactly as sent; `null` = no observation. */
  readonly scoreRaw: string | null;
  readonly hasScore: boolean;
  /** This region's own weight in basis points; `null` = the criterion is not part of its score. */
  readonly weightBps: number | null;
  readonly flag: string | null;
  readonly evidenceClass: EvidenceClass | null;
}

export interface CompositeRegionRow {
  readonly regionId: string;
  readonly name: string;
  /** Server rank within this list (filter-scoped); ties share a rank. Never recomputed. */
  readonly rank: number | null;
  /** Server rank among nationally eligible regions. */
  readonly nationalRank: number | null;
  readonly scoreText: string | null;
  /** The composite score exactly as the Data Hub sent it (decimal string). */
  readonly scoreRaw: string | null;
  readonly coveragePct: number | null;
  readonly tier: CoverageTierView;
  readonly components: readonly RegionComponent[];
  /** Criteria this region has no value for (shown, not counted as zero). */
  readonly missingIndicators: readonly string[];
  /** Criteria estimated at province level (IMPUTED_PROVINCE): a granularity fact, apart from coverage. */
  readonly imputedIndicators: readonly string[];
  /** Region weights differ from the global effective weights (partial coverage). */
  readonly weightsDiffer: boolean;
  readonly effectiveWeightsRegion: Readonly<Record<string, number>> | null;
  readonly isFocus: boolean;
}

export interface InsufficientRegionRow {
  readonly regionId: string;
  readonly name: string;
  readonly coveragePct: number | null;
  readonly componentsUsed: readonly string[];
  readonly missingIndicators: readonly string[];
  /** Backend reason code as sent. */
  readonly reason: string;
  readonly reasonText: string;
  /** Component scores exactly as sent; `null` = no observation. */
  readonly componentScores: Readonly<Record<string, string | null>>;
  readonly isFocus: boolean;
}

export interface CompositeIndicatorInfo {
  readonly indicatorId: string;
  readonly label: string;
  readonly category: string;
  readonly unitLabel: string;
  readonly referenceYear: number | null;
  readonly polarity: string | null;
  readonly source: IndicatorSourceInfo;
  readonly requestedBps: number;
  /** Global effective weight; `null` = the indicator has no national data and was left out. */
  readonly effectiveBps: number | null;
  readonly nationallyAvailable: boolean;
}

export type FocusStatus = 'RANKED' | 'NOT_RANKED' | 'ABSENT' | 'WITHHELD';

export interface FocusView {
  readonly regionId: string;
  readonly status: FocusStatus;
  readonly name: string | null;
  readonly message: string;
}

export interface PresetView {
  readonly presetId: string;
  readonly label: string;
  /** The Data Hub's verdict; `null` = it reported no availability for this preset. */
  readonly rankable: boolean | null;
  readonly requestedWeightAvailabilityPct: number | null;
}

export interface CompositeScope {
  readonly provinceId: string | null;
  /** Name from the Data Hub region registry; `null` = could not be loaded (the code is shown instead). */
  readonly provinceName: string | null;
  readonly totalRegions: number;
  readonly totalEligibleNational: number | null;
  readonly totalExcluded: number | null;
  readonly minCoveragePct: number | null;
  readonly minComponents: number | null;
  readonly scoreDirection: string | null;
}

export interface CompositeEvidenceRecord extends EvidenceBase {
  readonly kind: 'lab';
  readonly scope: CompositeScope;
  /** What the person asked for (from the link), in basis points. */
  readonly requestedWeights: Readonly<Record<string, number>>;
  /** The GLOBAL weights actually used, as the Data Hub reports them; `null` = not reported. */
  readonly effectiveWeights: Readonly<Record<string, number>> | null;
  readonly renormalized: boolean | null;
  readonly unavailableIndicatorIds: readonly string[];
  readonly preset: PresetView | null;
  readonly integrity: {
    /** True only when the integrity check found nothing blocking. */
    readonly ok: boolean;
    readonly issues: readonly CompositeIssueView[];
    readonly maxScoreError: number;
    readonly requestedWeightAvailabilityPct: number | null;
    readonly coverageTiers: { readonly complete: number; readonly partial: number };
  };
  /** `WITHHELD` = the ranking is not shown and no region rows are included. */
  readonly ranking: 'SHOWN' | 'WITHHELD';
  /** Why the ranking is withheld; `null` when it is shown. */
  readonly withheldReason: 'INTEGRITY' | 'MIXED_SOURCES' | 'DIRECTION_ANOMALY' | null;
  /** The direction check against the source (LIVE): what it found, never a correction. */
  readonly direction: CompositeDirectionReview;
  /** How many ranked regions the Data Hub sent, whether or not they are shown here. */
  readonly serverRankedCount: number;
  readonly rows: readonly CompositeRegionRow[];
  readonly insufficient: readonly InsufficientRegionRow[];
  readonly indicators: readonly CompositeIndicatorInfo[];
  readonly focus: FocusView | null;
  /** Wording of what the score and rank mean, from the validated direction. */
  readonly scoreMeaning: string;
}
