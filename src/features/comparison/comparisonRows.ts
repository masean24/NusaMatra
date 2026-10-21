import {
  assessComparison,
  type ComparableMeasurement,
  type ComparisonAssessment,
} from '@/domain/comparability';
import type { RegionProfileDTO, RegionProfileIndicatorValueDTO } from '@/services/api';

export interface ComparisonSide {
  readonly decimal: string | null;
  readonly referenceYear: number | null;
  readonly agencyCode: string;
  readonly qualityFlag: string | null;
}

export interface ComparisonRow {
  readonly indicatorId: string;
  readonly label: string;
  readonly category: string;
  readonly unit: string;
  readonly a: ComparisonSide | null;
  readonly b: ComparisonSide | null;
  readonly assessment: ComparisonAssessment;
}

function sideOf(item: RegionProfileIndicatorValueDTO | undefined): ComparisonSide | null {
  if (!item) return null;
  return {
    decimal: item.value.status === 'AVAILABLE' ? item.value.decimal : null,
    referenceYear: item.referenceYear,
    agencyCode: item.provenance.agencyCode,
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
    datasetId: item?.provenance.datasetId ?? '',
    qualityFlag: side?.qualityFlag ?? null,
  };
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
    return {
      indicatorId,
      label: reference?.indicatorName ?? indicatorId,
      category: reference?.category ?? '',
      unit,
      a: sideOf(itemA),
      b: sideOf(itemB),
      assessment: assessComparison(measurementOf(itemA, unit), measurementOf(itemB, unit)),
    };
  });
}
