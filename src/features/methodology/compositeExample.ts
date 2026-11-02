import { TOTAL_BASIS_POINTS, computeWeightedScore } from '@/domain/prioritization';

/** The worked composite's weights (basis points, total 10 000): an example, not a recommendation. */
export const EXAMPLE_WEIGHTS = {
  soc_hdi: 3000,
  dis_multihazard_index: 3000,
  soc_poverty_rate: 2000,
  hlt_stunting_prevalence: 2000,
} as const satisfies Record<string, number>;

export type ExampleCriterion = keyof typeof EXAMPLE_WEIGHTS;

export const EXAMPLE_CRITERIA = Object.keys(EXAMPLE_WEIGHTS) as ExampleCriterion[];

export interface ContributionRow {
  readonly id: ExampleCriterion;
  /** The Data Hub's 0–100 need score for the region; `null` = no value. */
  readonly needScore: number | null;
  readonly basisPoints: number;
  /** needScore × weight; `null` when the region has no value for this criterion. */
  readonly contribution: number | null;
}

export interface CompositeExample {
  readonly rows: readonly ContributionRow[];
  /** Σ need score × weight ÷ 10 000; `null` when a weighted criterion has no value. */
  readonly total: number | null;
  readonly missing: readonly ExampleCriterion[];
}

/**
 * The composite of the example weights for one region, from the Data Hub's need scores: each
 * criterion contributes its score times its share of the weight, and the composite is the sum. A
 * missing value is never treated as zero: the total is then left out (the Data Hub redistributes
 * that weight and marks the region "Data sebagian").
 */
export function buildCompositeExample(
  needScores: Readonly<Partial<Record<ExampleCriterion, number | null>>>,
): CompositeExample {
  const rows = EXAMPLE_CRITERIA.map((id) => {
    const score = needScores[id] ?? null;
    const basisPoints = EXAMPLE_WEIGHTS[id];
    return {
      id,
      needScore: score,
      basisPoints,
      contribution: score === null ? null : (score * basisPoints) / TOTAL_BASIS_POINTS,
    };
  });
  const missing = rows.filter((row) => row.needScore === null).map((row) => row.id);
  const result = computeWeightedScore(
    Object.fromEntries(rows.map((row) => [row.id, row.needScore === null ? null : row.needScore / 100])),
    EXAMPLE_WEIGHTS,
  );
  return { rows, total: result.status === 'scored' ? result.score * 100 : null, missing };
}
