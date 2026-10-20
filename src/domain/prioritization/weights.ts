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

/**
 * Moves one criterion to `requestedBps` and rebalances the others so the total stays exactly
 * `TOTAL_BASIS_POINTS`. The rule is deterministic:
 *
 * 1. The changed weight becomes an integer clamped to [0, 10 000].
 * 2. The remainder is shared among the other criteria in proportion to their current weights,
 *    using the largest-remainder method so every share is an integer and the shares add up exactly.
 *    Ties go to the criterion listed first.
 * 3. If every other weight is 0, the remainder is shared equally by the same method.
 * 4. A lone criterion always holds the whole total.
 */
export function redistributeWeights<CriterionId extends string>(
  weights: WeightsBps<CriterionId>,
  changedId: NoInfer<CriterionId>,
  requestedBps: number,
): WeightsBps<CriterionId> {
  const others = (Object.keys(weights) as CriterionId[]).filter((id) => id !== changedId);
  const changed = Math.min(TOTAL_BASIS_POINTS, Math.max(0, Math.round(requestedBps)));
  const remainder = others.length === 0 ? 0 : TOTAL_BASIS_POINTS - changed;

  const currentTotal = others.reduce((sum, id) => sum + weights[id], 0);
  // Integer arithmetic throughout: `numerator / divisor` is each criterion's exact share.
  const divisor = currentTotal > 0 ? currentTotal : others.length;
  const shares = others.map((id, index) => {
    const numerator = (currentTotal > 0 ? weights[id] : 1) * remainder;
    return { id, index, whole: Math.floor(numerator / divisor), fraction: numerator % divisor };
  });

  let leftover = remainder - shares.reduce((sum, share) => sum + share.whole, 0);
  const byLargestFraction = [...shares].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const bonus = new Set<CriterionId>();
  for (const share of byLargestFraction) {
    if (leftover <= 0) break;
    bonus.add(share.id);
    leftover -= 1;
  }

  const result: Record<string, number> = { [changedId]: others.length === 0 ? TOTAL_BASIS_POINTS : changed };
  for (const share of shares) result[share.id] = share.whole + (bonus.has(share.id) ? 1 : 0);
  // Same keys, same order as the input: callers render sliders in that order.
  return Object.fromEntries(
    Object.keys(weights).map((id) => [id, result[id] ?? 0]),
  ) as WeightsBps<CriterionId>;
}

/** Display projection only: basis points to a whole-number percentage (4500 → 45). */
export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100;
}
