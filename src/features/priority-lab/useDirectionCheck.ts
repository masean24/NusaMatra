import { checkComponentDirection, type DirectionVerdict, type ReferenceValue } from '@/domain/prioritization';
import { useDataHubResource, type ResourceState } from '@/features/data-hub';
import type { ExploratoryCompositeResultDTO, IndicatorValuesMapDTO } from '@/services/api';
import type { IndicatorOption } from './labModel';

export interface DirectionCheck {
  readonly indicatorId: string;
  readonly verdict: DirectionVerdict;
}

function referenceOf(values: IndicatorValuesMapDTO): Record<string, ReferenceValue> {
  return Object.fromEntries(
    Object.entries(values.valuesByRegion).map(([regionId, cell]) => {
      const raw = cell.value.status === 'AVAILABLE' ? Number(cell.value.decimal) : null;
      const normalized = cell.normalizedScoreDecimal === null ? null : Number(cell.normalizedScoreDecimal);
      return [
        regionId,
        {
          raw: raw !== null && Number.isFinite(raw) ? raw : null,
          normalized: normalized !== null && Number.isFinite(normalized) ? normalized : null,
          // The indicator's own flag for this observation, independent of the composite's quality_flags.
          qualityFlag: cell.qualityFlag,
        },
      ];
    }),
  );
}

/**
 * LIVE only: fetches the published values of every indicator the ranking used and checks that each
 * component score follows the indicator's direction under `higher_is_need` (a worse raw value gives a
 * higher score) and equals its published normalised score. A response of the older orientation is
 * checked in that orientation, so it fails the integrity gate first (SCORE_DIRECTION_UNREPORTED).
 * `idle` when there is nothing to check.
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
      return ids.map((indicatorId, index) => {
        const values = valueSets[index];
        const polarity = options.find((option) => option.id === indicatorId)?.polarity ?? '';
        const components = Object.fromEntries(
          result.items.map((item) => {
            const score = item.componentScoresDecimal[indicatorId];
            return [item.regionId, score === null || score === undefined ? null : Number(score)];
          }),
        );
        // A value estimated from the province (IMPUTED_PROVINCE) is not on the observed raw-to-score curve.
        const imputed = new Set(
          result.items
            .filter((item) => item.qualityFlags?.[indicatorId] === 'IMPUTED_PROVINCE')
            .map((item) => item.regionId),
        );
        return {
          indicatorId,
          verdict: values
            ? checkComponentDirection({
                polarity,
                components,
                reference: referenceOf(values.data),
                // v2.1 normalises over the whole nation, also for a province-filtered ranking (checked on the
                // captured Jateng response: every component equals the indicator's published score).
                compareToPublished:
                  result.scoreDirection === 'higher_is_need' || result.filterProvinceId === null,
                imputedRegionIds: imputed,
                scoreDirection:
                  result.scoreDirection === 'higher_is_need' ? 'higher_is_need' : 'higher_is_better',
              })
            : { status: 'unverifiable' as const, reason: 'Nilai sumber tidak tersedia.' },
        };
      });
    },
    result !== null && ids.length > 0,
  );
}
