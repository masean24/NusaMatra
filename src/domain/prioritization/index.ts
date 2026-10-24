export {
  TOTAL_BASIS_POINTS,
  addCriterion,
  basisPointsToPercent,
  redistributeWeights,
  removeCriterion,
  scaleToTotal,
  validateWeights,
} from './weights';
export type { WeightsBps, WeightsValidation } from './weights';
export { computeWeightedScore, rankRegions } from './scoring';
export type { NormalizedValues, RankedRegion, Ranking, ScoreResult, ScoringRegion } from './scoring';
export {
  assessCompositeIntegrity,
  classifyCoverage,
  EXPECTED_SCORE_DIRECTION,
  FRONTEND_MIN_REQUESTED_WEIGHT_PCT,
  requestedWeightAvailabilityPct,
  SCORE_TOLERANCE,
  scoreToleranceFor,
} from './compositeIntegrity';
export type {
  CompositeIntegrity,
  CompositeIntegrityInput,
  CompositeIssue,
  CompositeIssueCode,
  CompositeIssueSeverity,
  CompositeRowInput,
  CoverageTier,
  InsufficientRowInput,
} from './compositeIntegrity';
export { checkComponentDirection } from './componentDirection';
export type { DirectionCheckInput, DirectionVerdict, ReferenceValue } from './componentDirection';
export { assessDirectionImpact } from './directionImpact';
export type {
  DirectionAnomaly,
  DirectionImpact,
  DirectionImpactCheck,
  DirectionImpactInput,
  DirectionImpactRow,
} from './directionImpact';
