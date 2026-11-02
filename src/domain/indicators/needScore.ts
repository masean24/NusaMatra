/**
 * The Data Hub's need score (methodology "min-max full range"): every indicator is put on a 0–100
 * scale between the lowest and highest value among all kabupaten/kota that have data, oriented so
 * that 100 is the greatest need.
 *
 * - polarity "negative" (a higher value is worse, e.g. poverty): (value − min) ÷ (max − min) × 100
 * - polarity "positive" (a higher value is better, e.g. HDI):    (max − value) ÷ (max − min) × 100
 *
 * Checked against the live Data Hub on 2026-11-02: the formula reproduces its `norm` for every
 * region of five indicators of both polarities, to the second decimal.
 */

/** Which end of the raw scale is the greatest need; `null` when the direction is not stated. */
export type NeedEnd = 'HIGH_VALUE_IS_NEED' | 'LOW_VALUE_IS_NEED';

export function needEndOf(polarity: string): NeedEnd | null {
  if (polarity === 'negative') return 'HIGH_VALUE_IS_NEED';
  if (polarity === 'positive') return 'LOW_VALUE_IS_NEED';
  return null;
}

export interface NeedScoreInput {
  readonly value: number;
  /** Lowest value among the regions with data. */
  readonly min: number;
  /** Highest value among the regions with data. */
  readonly max: number;
  readonly polarity: string;
}

/**
 * The 0–100 need score, or `null` when it cannot be computed: no stated direction, or every region
 * has the same value (no range to scale over). A value outside [min, max] is clipped.
 */
export function needScore({ value, min, max, polarity }: NeedScoreInput): number | null {
  const end = needEndOf(polarity);
  if (end === null || !(max > min) || !Number.isFinite(value)) return null;
  const share = end === 'HIGH_VALUE_IS_NEED' ? (value - min) / (max - min) : (max - value) / (max - min);
  return Math.min(100, Math.max(0, share * 100));
}
