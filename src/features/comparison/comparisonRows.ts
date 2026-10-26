import {
  assessComparison,
  type ComparableMeasurement,
  type ComparisonAssessment,
} from '@/domain/comparability';
import type { RegionProfileDTO, RegionProfileIndicatorValueDTO } from '@/services/api';

/** The Data Hub's placeholders for a source that sent no dataset or agency (see domainMappers). */
const UNKNOWN_DATASET = 'unknown_dataset';
const UNKNOWN_AGENCY = 'UNKNOWN_AGENCY';

/** Platform audit metrics (completeness, freshness) describe the data, not the region. */
const DATA_QUALITY_CATEGORY = 'data_reliability';

export interface ComparisonSide {
  /** The value exactly as the Data Hub sent it; `null` = no value (never 0). */
  readonly decimal: string | null;
  /** Why there is no value, when the Data Hub said so. */
  readonly valueStatus: 'AVAILABLE' | 'MISSING' | 'SUPPRESSED';
  readonly referenceYear: number | null;
  readonly agencyCode: string;
  readonly datasetId: string;
  readonly provenanceKnown: boolean;
  readonly officialUrl: string | null;
  readonly qualityFlag: string | null;
}

export interface ComparisonRow {
  readonly indicatorId: string;
  readonly label: string;
  readonly category: string;
  readonly unit: string;
  /**
   * `data_quality` rows describe the data pipeline itself: they are listed with their values but
   * never get a difference or a better/worse reading.
   */
  readonly kind: 'regional' | 'data_quality';
  readonly a: ComparisonSide | null;
  readonly b: ComparisonSide | null;
  readonly assessment: ComparisonAssessment;
}

function sideOf(item: RegionProfileIndicatorValueDTO | undefined): ComparisonSide | null {
  if (!item) return null;
  const { provenance, value } = item;
  return {
    decimal: value.status === 'AVAILABLE' ? value.decimal : null,
    valueStatus: value.status,
    referenceYear: item.referenceYear,
    agencyCode: provenance.agencyCode,
    datasetId: provenance.datasetId,
    provenanceKnown: provenance.datasetId !== UNKNOWN_DATASET && provenance.agencyCode !== UNKNOWN_AGENCY,
    officialUrl: provenance.officialUrl,
    qualityFlag: item.qualityFlag,
  };
}

function measurementOf(
  item: RegionProfileIndicatorValueDTO | undefined,
  fallbackUnit: string,
): ComparableMeasurement {
  const side = sideOf(item);
  const parsed = side?.decimal == null ? null : Number(side.decimal);
  return {
    value: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    unit: item?.unit ?? fallbackUnit,
    referenceYear: side?.referenceYear ?? null,
    datasetId: side?.datasetId ?? '',
    qualityFlag: side?.qualityFlag ?? null,
    provenanceKnown: side?.provenanceKnown ?? true,
    present: item !== undefined,
  };
}

export function isDataQualityIndicator(indicatorId: string, category: string): boolean {
  return category === DATA_QUALITY_CATEGORY || indicatorId.startsWith('meta_');
}

/**
 * One row per indicator either region has, in the Data Hub's order (A's first, then indicators only
 * B has). An indicator one region lacks is shown, not dropped, and blocks the comparison.
 */
export function buildComparisonRows(a: RegionProfileDTO, b: RegionProfileDTO): readonly ComparisonRow[] {
  const byId = (profile: RegionProfileDTO) =>
    new Map(profile.indicators.map((indicator) => [indicator.indicatorId, indicator]));
  const inA = byId(a);
  const inB = byId(b);
  const ids = [...new Set([...inA.keys(), ...inB.keys()])];

  return ids.map((indicatorId) => {
    const itemA = inA.get(indicatorId);
    const itemB = inB.get(indicatorId);
    const reference = itemA ?? itemB;
    const unit = reference?.unit ?? '';
    const category = reference?.category ?? '';
    return {
      indicatorId,
      label: reference?.indicatorName ?? indicatorId,
      category,
      unit,
      kind: isDataQualityIndicator(indicatorId, category) ? 'data_quality' : 'regional',
      a: sideOf(itemA),
      b: sideOf(itemB),
      assessment: assessComparison(measurementOf(itemA, unit), measurementOf(itemB, unit)),
    };
  });
}
