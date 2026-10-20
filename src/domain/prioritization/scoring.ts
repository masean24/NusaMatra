import { TOTAL_BASIS_POINTS, validateWeights, type WeightsBps } from './weights';

/** Indicator values already normalised to 0..1 and oriented so that higher means higher priority. */
export type NormalizedValues<CriterionId extends string> = Readonly<
  Partial<Record<CriterionId, number | null>>
>;

export interface ScoringRegion<CriterionId extends string> {
  /** Stable identifier; also the documented tie-breaker. */
  readonly code: string;
  readonly name: string;
  readonly values: NormalizedValues<CriterionId>;
}

export type ScoreResult<CriterionId extends string> =
  { status: 'scored'; score: number } | { status: 'unscorable'; missingCriteria: readonly CriterionId[] };

export interface RankedRegion<CriterionId extends string> {
  readonly region: ScoringRegion<CriterionId>;
  readonly rank: number;
  readonly score: number;
}

export interface Ranking<CriterionId extends string> {
  readonly ranked: readonly RankedRegion<CriterionId>[];
  /** Regions left out because a weighted criterion has no value. Missing data is never treated as zero. */
  readonly unscorable: readonly {
    region: ScoringRegion<CriterionId>;
    missingCriteria: readonly CriterionId[];
  }[];
}

function criteriaOf<CriterionId extends string>(weights: WeightsBps<CriterionId>): CriterionId[] {
  return Object.keys(weights) as CriterionId[];
}

function assertValid<CriterionId extends string>(weights: WeightsBps<CriterionId>): void {
  const validation = validateWeights(weights);
  if (!validation.valid) {
    throw new RangeError(`Invalid weights (${validation.reason}): ${validation.detail}`);
  }
}

/**
 * Weighted mean of normalised values: Σ value_i × weight_i / 10000.
 * Criteria with zero weight do not need a value. A weighted criterion without a value
 * blocks the score (docs/01 DEC-06: block by default until a missing-data policy is approved).
 */
export function computeWeightedScore<CriterionId extends string>(
  values: NormalizedValues<CriterionId>,
  weights: WeightsBps<CriterionId>,
): ScoreResult<CriterionId> {
  assertValid(weights);

  const missingCriteria = criteriaOf(weights).filter((criterion) => {
    // An absent key and an explicit null both mean "no value"; zero is a real value.
    return weights[criterion] > 0 && typeof values[criterion] !== 'number';
  });
  if (missingCriteria.length > 0) {
    return { status: 'unscorable', missingCriteria };
  }

  const weightedSum = criteriaOf(weights).reduce((sum, criterion) => {
    const value = values[criterion] ?? 0;
    if (value < 0 || value > 1) {
      throw new RangeError(`Normalised value for ${criterion} must be within 0..1, got ${value}`);
    }
    return sum + value * weights[criterion];
  }, 0);

  return { status: 'scored', score: weightedSum / TOTAL_BASIS_POINTS };
}

/** Highest score first; ties are broken by region code so the order is deterministic. */
export function rankRegions<CriterionId extends string>(
  regions: readonly ScoringRegion<CriterionId>[],
  weights: WeightsBps<CriterionId>,
): Ranking<CriterionId> {
  const scored: { region: ScoringRegion<CriterionId>; score: number }[] = [];
  const unscorable: Ranking<CriterionId>['unscorable'][number][] = [];

  for (const region of regions) {
    const result = computeWeightedScore(region.values, weights);
    if (result.status === 'scored') {
      scored.push({ region, score: result.score });
    } else {
      unscorable.push({ region, missingCriteria: result.missingCriteria });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.region.code.localeCompare(b.region.code));

  return {
    ranked: scored.map((entry, index) => ({ ...entry, rank: index + 1 })),
    unscorable,
  };
}
