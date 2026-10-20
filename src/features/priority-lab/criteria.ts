import { TOTAL_BASIS_POINTS, validateWeights } from '@/domain/prioritization';

/**
 * The Lab starts from the four criteria, and the weights, that the Data Hub's own captured preview
 * (`composite_valid`) used. They are a starting point for exploration, not a recommended model.
 */
export const DEFAULT_CRITERIA = {
  dis_multihazard_index: 3500,
  soc_poverty_rate: 2500,
  edu_damaged_classrooms_pct: 2000,
  hlt_stunting_prevalence: 2000,
} as const satisfies Record<string, number>;

export type CriterionId = keyof typeof DEFAULT_CRITERIA;

export const DEFAULT_CRITERION_IDS = Object.keys(DEFAULT_CRITERIA) as CriterionId[];

if (!validateWeights(DEFAULT_CRITERIA).valid) {
  throw new Error(`DEFAULT_CRITERIA must sum to ${String(TOTAL_BASIS_POINTS)} basis points.`);
}

/** Stable text identity of a weight set, for request keys and cache keys. */
export function weightsKey(weights: Readonly<Record<string, number>>): string {
  return Object.entries(weights)
    .filter(([, bps]) => bps > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, bps]) => `${id}:${String(bps)}`)
    .join('|');
}
