import { useDataHubResource, type ResourceState } from '@/features/data-hub';
import type { ExploratoryCompositeResultDTO } from '@/services/api';
import { checkRankingDirections, type DirectionCheck } from './directionChecks';
import type { IndicatorOption } from './labModel';

export type { DirectionCheck } from './directionChecks';

/**
 * LIVE only: fetches the published values of every indicator the ranking used and checks that each
 * component score follows the indicator's direction under `higher_is_need` (a worse raw value gives a
 * higher score) and equals its published normalised score, both in the ranking and nationally. A
 * response of the older orientation is checked in that orientation, so it fails the integrity gate first
 * (SCORE_DIRECTION_UNREPORTED). `idle` when there is nothing to check.
 */
export function useDirectionCheck(
  result: ExploratoryCompositeResultDTO | null,
  weightsUsed: Readonly<Record<string, number>>,
  options: readonly IndicatorOption[],
): { readonly state: ResourceState<readonly DirectionCheck[]>; readonly retry: () => void } {
  const ids = Object.keys(weightsUsed)
    .filter((id) => (weightsUsed[id] ?? 0) > 0)
    .sort();
  const key = `direction|${result?.filterProvinceId ?? 'all'}|${ids.join(',')}|${String(result?.items.length ?? 0)}`;

  return useDataHubResource(
    key,
    async (repository, dataMode, signal) => {
      if (!result) return [];
      const valueSets = await Promise.all(
        ids.map((indicatorId) => repository.getIndicatorValues({ dataMode, indicatorId, signal })),
      );
      const byId = new Map(ids.map((indicatorId, index) => [indicatorId, valueSets[index]?.data ?? null]));
      return checkRankingDirections(
        result,
        ids,
        (indicatorId) => options.find((option) => option.id === indicatorId)?.polarity ?? '',
        (indicatorId) => byId.get(indicatorId) ?? null,
      );
    },
    result !== null && ids.length > 0,
  );
}
