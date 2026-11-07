export { describeUnit, ratioIsMeaningful } from './units';
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
export { needEndOf, needScore } from './needScore';
export type { NeedEnd, NeedScoreInput } from './needScore';
export { SIMILAR_RATIO, SIMILAR_YEARS, isNearlyEqual, readComparison } from './interpretComparison';
export type { ComparisonReading, ComparisonReadingInput, ComparisonVerdict } from './interpretComparison';
