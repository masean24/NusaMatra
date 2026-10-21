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
): CompositeIntegrityInput {
  return {
    weightsBasisPoints: result.weightsBasisPoints,
    reportedTotalRegions: result.totalRegions,
    registryRegionCount,
    rows: result.items.map((item) => ({
      regionId: item.regionId,
      rankPosition: item.rankPosition,
      compositeScore: toNumber(item.compositeScoreDecimal),
      componentScores: Object.fromEntries(
        Object.entries(item.componentScoresDecimal).map(([id, score]) => [id, toNumber(score)]),
      ),
    })),
  };
}
