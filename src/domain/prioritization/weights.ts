/** Canonical weights are integer basis points; a complete set sums to exactly this value. */
export const TOTAL_BASIS_POINTS = 10_000;

export type WeightsBps<CriterionId extends string> = Readonly<Record<CriterionId, number>>;

export type WeightsValidation =
  { valid: true } | { valid: false; reason: 'not_integer' | 'negative' | 'wrong_total'; detail: string };

export function validateWeights<CriterionId extends string>(
  weights: WeightsBps<CriterionId>,
): WeightsValidation {
  const entries = Object.entries<number>(weights);

  const nonInteger = entries.find(([, value]) => !Number.isInteger(value));
  if (nonInteger) {
    return { valid: false, reason: 'not_integer', detail: `${nonInteger[0]} = ${nonInteger[1]}` };
  }

  const negative = entries.find(([, value]) => value < 0);
  if (negative) {
    return { valid: false, reason: 'negative', detail: `${negative[0]} = ${negative[1]}` };
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total !== TOTAL_BASIS_POINTS) {
    return { valid: false, reason: 'wrong_total', detail: `total = ${total}` };
  }

  return { valid: true };
}

/** Display projection only: basis points to a whole-number percentage (4500 → 45). */
export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}
