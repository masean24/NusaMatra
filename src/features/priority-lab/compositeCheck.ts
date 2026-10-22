import type { CompositeIntegrityInput } from '@/domain/prioritization';
import type { ExploratoryCompositeResultDTO } from '@/services/api';

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The plain numbers `assessCompositeIntegrity` checks, taken from the response without altering them. */
export function integrityInputFromResult(
  result: ExploratoryCompositeResultDTO,
  registryRegionCount: number | null = null,
  requestedWeights: Readonly<Record<string, number>> | null = null,
): CompositeIntegrityInput {
  return {
    weightsBasisPoints: result.weightsBasisPoints,
    requestedWeights,
    effectiveWeightsBasisPoints: result.effectiveWeightsBasisPoints,
    unavailableIndicatorIds: result.unavailableIndicatorIds,
    renormalized: result.renormalized,
    filterProvinceId: result.filterProvinceId,
    reportedTotalRegions: result.totalRegions,
    registryRegionCount,
    rows: result.items.map((item) => ({
      regionId: item.regionId,
      rankPosition: item.rankPosition,
      // A score the API sent but that is not a number stays visible to the check as NaN, not null.
      compositeScore:
        item.compositeScoreDecimal === null ? null : (toNumber(item.compositeScoreDecimal) ?? Number.NaN),
      componentScores: Object.fromEntries(
        Object.entries(item.componentScoresDecimal).map(([id, score]) => [id, toNumber(score)]),
      ),
    })),
  };
}
