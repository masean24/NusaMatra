import {
  describeUnit,
  needEndOf,
  needScore,
  readIndicator,
  type IndicatorReading,
  type NeedEnd,
} from '@/domain/indicators';
import { describeObservation } from '@/features/data-hub';
import type { IndicatorValuesMapDTO } from '@/services/api';

/** How far the recomputed score may sit from the Data Hub's before the page says they differ. */
const MATCH_TOLERANCE = 0.05;

interface ExampleBase {
  readonly indicatorLabel: string;
  readonly regionName: string;
  readonly referenceYear: number | null;
  readonly agency: string;
}

/** The region has no value for the indicator: it gets no score (never zero). */
export interface MissingExample extends ExampleBase {
  readonly status: 'missing';
}

/** One indicator for one region, worked through with the Data Hub's own numbers. */
export interface ReadyExample extends ExampleBase {
  readonly status: 'ready';
  /** The raw value as the source states it ("9,82"). */
  readonly valueText: string;
  /** The unit after the value (" %"), empty when the unit is a plain number. */
  readonly unitText: string;
  readonly value: number;
  /** An estimate published at province level and applied to the kabupaten/kota. */
  readonly provinceEstimate: boolean;
  /** National lowest and highest among the regions with data; `null` when the Data Hub sends none. */
  readonly range: { readonly min: number; readonly max: number } | null;
  readonly regionsWithData: number;
  /** Which end of the scale is need; `null` when the indicator's direction is not set. */
  readonly needEnd: NeedEnd | null;
  /** The formula recomputed here, only to show it gives the Data Hub's score. */
  readonly computed: number | null;
  /** The Data Hub's need score (0–100), the one the site uses. */
  readonly reported: number | null;
  readonly reportedText: string | null;
  readonly percentile: number | null;
  readonly percentileText: string | null;
  readonly rank: number | null;
  readonly matches: boolean;
  readonly reading: IndicatorReading;
}

export type IndicatorExample = MissingExample | ReadyExample;

function toNumber(decimal: string | null | undefined): number | null {
  if (decimal === null || decimal === undefined) return null;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The worked example for one region from an indicator's values map. Every number comes from the
 * Data Hub; `computed` is the published formula applied to the Data Hub's own value and range.
 */
export function buildIndicatorExample(
  data: IndicatorValuesMapDTO,
  regionId: string,
  regionName: string,
): IndicatorExample {
  const { indicator } = data;
  const base: ExampleBase = {
    indicatorLabel: indicator.labelId,
    regionName,
    referenceYear: indicator.referenceYear,
    agency: indicator.provenance.agencyCode,
  };
  const cell = data.valuesByRegion[regionId];
  if (!cell || cell.value.status !== 'AVAILABLE') return { ...base, status: 'missing' };

  const min = toNumber(indicator.stats?.min);
  const max = toNumber(indicator.stats?.max);
  const range = min === null || max === null ? null : { min, max };
  const value = Number(cell.value.decimal);
  const unit = describeUnit(indicator.unitCode, max);
  const needEnd = needEndOf(indicator.polarity);
  const computed = range ? needScore({ value, ...range, polarity: indicator.polarity }) : null;
  const reported = toNumber(cell.normalizedScoreDecimal);
  const percentile = toNumber(cell.percentileDecimal);

  return {
    ...base,
    status: 'ready',
    valueText: describeObservation(cell.value),
    unitText: unit.label ? ` ${unit.label}` : '',
    value,
    provinceEstimate: cell.qualityFlag?.startsWith('IMPUTED') ?? false,
    range,
    regionsWithData: Object.values(data.valuesByRegion).filter((entry) => entry.value.status === 'AVAILABLE')
      .length,
    needEnd,
    computed,
    reported,
    reportedText: cell.normalizedScoreDecimal,
    percentile,
    percentileText: cell.percentileDecimal,
    rank: cell.rank,
    matches: computed !== null && reported !== null && Math.abs(computed - reported) <= MATCH_TOLERANCE,
    reading: readIndicator({
      polarity: indicator.polarity,
      percentile,
      percentileOrientation: 'NEED_SHARE',
      qualityFlag: cell.qualityFlag,
      hasValue: true,
    }),
  };
}
