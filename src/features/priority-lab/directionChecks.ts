import {
  checkComponentDirection,
  type DirectionImpactRow,
  type DirectionVerdict,
  type ReferenceValue,
} from '@/domain/prioritization';
import type { ExploratoryCompositeResultDTO, IndicatorValuesMapDTO } from '@/services/api';

export interface DirectionCheck {
  readonly indicatorId: string;
  /** Over the regions of the ranking. */
  readonly verdict: DirectionVerdict;
  /**
   * Over every region of the indicator's published values (v2.1 normalises nationally), so an anomaly
   * outside a province filter, which still enters `national_rank`, is seen. `null` = not checkable.
   */
  readonly nationalVerdict: DirectionVerdict | null;
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

const UNAVAILABLE: DirectionVerdict = { status: 'unverifiable', reason: 'Nilai sumber tidak tersedia.' };

/**
 * Checks, per weighted indicator, that the ranking's component scores follow the indicator's direction
 * (and, where valid, equal its published score), and the same for the indicator's published scores
 * across the whole country. Pure: the same rule for Lab Prioritas and Paspor Bukti. Detection only.
 */
export function checkRankingDirections(
  result: ExploratoryCompositeResultDTO,
  indicatorIds: readonly string[],
  polarityOf: (indicatorId: string) => string,
  valuesOf: (indicatorId: string) => IndicatorValuesMapDTO | null,
): DirectionCheck[] {
  const needOriented = result.scoreDirection === 'higher_is_need';
  return indicatorIds.map((indicatorId) => {
    const values = valuesOf(indicatorId);
    if (!values) return { indicatorId, verdict: UNAVAILABLE, nationalVerdict: null };
    const polarity = polarityOf(indicatorId);
    const reference = referenceOf(values);
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
    const verdict = checkComponentDirection({
      polarity,
      components,
      reference,
      // v2.1 normalises over the whole nation, also for a province-filtered ranking (checked on the
      // captured Jateng response: every component equals the indicator's published score).
      compareToPublished: needOriented || result.filterProvinceId === null,
      imputedRegionIds: imputed,
      scoreDirection: needOriented ? 'higher_is_need' : 'higher_is_better',
    });
    // The published scores themselves, over every region: only meaningful under the v2.1 orientation.
    const nationalVerdict = needOriented
      ? checkComponentDirection({
          polarity,
          components: Object.fromEntries(
            Object.entries(reference).map(([regionId, value]) => [regionId, value.normalized]),
          ),
          reference,
          compareToPublished: false,
          scoreDirection: 'higher_is_need',
        })
      : null;
    return { indicatorId, verdict, nationalVerdict };
  });
}

/** The ranked rows as the impact rule needs them. */
export const impactRowsOf = (result: ExploratoryCompositeResultDTO): DirectionImpactRow[] =>
  result.items.map((item) => ({ regionId: item.regionId, effectiveWeights: item.effectiveWeightsRegion }));
