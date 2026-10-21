import { TOTAL_BASIS_POINTS, validateWeights } from '@/domain/prioritization';
import type { DataMode } from '@/services/api';

/**
 * The DEMO Lab starts from the four criteria, and the weights, that the Data Hub's own captured
 * preview (`composite_valid`) used. They are a starting point for exploration, not a recommended model.
 */
export const DEFAULT_CRITERIA = {
  dis_multihazard_index: 3500,
  soc_poverty_rate: 2500,
  edu_damaged_classrooms_pct: 2000,
  hlt_stunting_prevalence: 2000,
} as const satisfies Record<string, number>;

/**
 * The LIVE Lab starts only from criteria the deployed snapshot has values for. The DEMO set above
 * includes `edu_damaged_classrooms_pct`, which the LIVE catalog lists but holds no values for, so
 * the backend would silently drop that 20 % of the weight.
 */
export const LIVE_CRITERIA = {
  soc_hdi: 3000,
  dis_multihazard_index: 3000,
  soc_poverty_rate: 2000,
  hlt_stunting_prevalence: 2000,
} as const satisfies Record<string, number>;

export type CriterionId = keyof typeof DEFAULT_CRITERIA;

export const DEFAULT_CRITERION_IDS = Object.keys(DEFAULT_CRITERIA) as CriterionId[];

for (const criteria of [DEFAULT_CRITERIA, LIVE_CRITERIA] as readonly Readonly<Record<string, number>>[]) {
  if (!validateWeights(criteria).valid) {
    throw new Error(`Starting criteria must sum to ${String(TOTAL_BASIS_POINTS)} basis points.`);
  }
}

/** Starting weights for the mode the page is in. */
export function startingCriteriaFor(dataMode: DataMode): Readonly<Record<string, number>> {
  return dataMode === 'LIVE' ? LIVE_CRITERIA : DEFAULT_CRITERIA;
}

/** Stable text identity of a weight set, for request keys and cache keys. */
export function weightsKey(weights: Readonly<Record<string, number>>): string {
  return Object.entries(weights)
    .filter(([, bps]) => bps > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, bps]) => `${id}:${String(bps)}`)
    .join('|');
}
