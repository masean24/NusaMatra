export { describeUnit } from './units';
export type { DisplayUnit, UnitKind } from './units';
export {
  DATA_HUB_PERCENTILE_ORIENTATION,
  FAVORABLE_FROM_PERCENT,
  UNFAVORABLE_UP_TO_PERCENT,
  isPolarity,
  polarityReading,
  readIndicator,
} from './interpretIndicator';
export type {
  ConditionVerdict,
  IndicatorPolarity,
  IndicatorReading,
  IndicatorReadingInput,
  PercentileOrientation,
} from './interpretIndicator';
export { readComparison } from './interpretComparison';
export type { ComparisonReading, ComparisonReadingInput, ComparisonVerdict } from './interpretComparison';
