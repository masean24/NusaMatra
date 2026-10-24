import type { CompositeIntegrityInput } from '@/domain/prioritization';
import type { ExploratoryCompositeResultDTO } from '@/services/api';

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const toNumbers = (scores: Readonly<Record<string, string | null>>): Record<string, number | null> =>
  Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, toNumber(score)]));

/**
 * The plain numbers `assessCompositeIntegrity` checks, taken from the response without altering them.
 * Read-only and pure, so other features (Paspor Bukti) can re-run the same checks on a stored result.
 *
 * @param result the mapped composite response
 * @param registryRegionCount regions of the registry in the same scope (province or national), if known
 * @param requestedWeights the weights the request sent; the echo must equal them
 * @param declaredRankable the Data Hub's `availability.rankable` of the preset these weights equal
 *   (`false` blocks the ranking); `null` when the weights are not a preset or the verdict is unknown
 */
export function integrityInputFromResult(
  result: ExploratoryCompositeResultDTO,
  registryRegionCount: number | null = null,
  requestedWeights: Readonly<Record<string, number>> | null = null,
  declaredRankable: boolean | null = null,
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
    dataMode: result.dataMode,
    scoreDirection: result.scoreDirection,
    totalEligibleNational: result.totalEligibleNational,
    totalExcluded: result.totalExcluded,
    minCoveragePct: result.minCoveragePct,
    minComponents: result.minComponents,
    declaredRankable,
    responseRankable: result.rankable,
    notRankableReason: result.notRankableReason,
    rows: result.items.map((item) => ({
      regionId: item.regionId,
      rankPosition: item.rankPosition,
      // A score the API sent but that is not a number stays visible to the check as NaN, not null.
      compositeScore:
        item.compositeScoreDecimal === null ? null : (toNumber(item.compositeScoreDecimal) ?? Number.NaN),
      componentScores: toNumbers(item.componentScoresDecimal),
      nationalRank: item.nationalRank,
      coveragePct: item.coveragePct,
      componentsUsed: item.componentsUsed,
      missingIndicators: item.missingIndicators,
      effectiveWeightsRegion: item.effectiveWeightsRegion,
      qualityFlags: item.qualityFlags,
    })),
    insufficientRows: result.insufficient.map((region) => ({
      regionId: region.regionId,
      coveragePct: region.coveragePct,
      componentsUsed: region.componentsUsed,
    })),
  };
}
