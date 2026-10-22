/**
 * Checks that a component score of the composite ranking points the way its indicator's polarity
 * says: for a "negative" indicator (poverty, hazard) a higher raw value must never give a higher
 * score, for a "positive" one (HDI) it must never give a lower one. With the national ranking it
 * also checks the component is the indicator's own published normalised score. Pure: detection only.
 */

export interface ReferenceValue {
  readonly raw: number | null;
  /** The indicator's published 0–100 normalised score for the region, if any. */
  readonly normalized: number | null;
}

export interface DirectionCheckInput {
  /** Backend vocabulary: "positive" | "negative" | other (not checkable). */
  readonly polarity: string;
  /** Component score per region, as the composite returned it. */
  readonly components: Readonly<Record<string, number | null>>;
  readonly reference: Readonly<Record<string, ReferenceValue>>;
  /**
   * Compare against the published normalised score too. Only valid for an unfiltered ranking: a
   * province-only ranking may legitimately normalise within the province.
   */
  readonly compareToPublished: boolean;
}

export type DirectionVerdict =
  | { readonly status: 'consistent'; readonly checked: number }
  | { readonly status: 'inconsistent'; readonly reason: string; readonly examples: readonly string[] }
  | { readonly status: 'unverifiable'; readonly reason: string };

/** Component scores are rounded to 2 decimals; anything closer than this is equal. */
const SCORE_EPSILON = 0.011;
const MAX_EXAMPLES = 5;

export function checkComponentDirection(input: DirectionCheckInput): DirectionVerdict {
  const pairs: { regionId: string; raw: number; score: number }[] = [];
  const offPublished: string[] = [];
  for (const [regionId, score] of Object.entries(input.components)) {
    const reference = input.reference[regionId];
    if (score === null || !reference) continue;
    if (
      input.compareToPublished &&
      reference.normalized !== null &&
      Math.abs(reference.normalized - score) > SCORE_EPSILON
    ) {
      offPublished.push(regionId);
    }
    if (reference.raw !== null) pairs.push({ regionId, raw: reference.raw, score });
  }
  if (offPublished.length > 0) {
    return {
      status: 'inconsistent',
      reason: `${String(offPublished.length)} skor komponen berbeda dari skor ternormalisasi yang dipublikasikan untuk indikator ini.`,
      examples: offPublished.slice(0, MAX_EXAMPLES),
    };
  }

  const sign = input.polarity === 'positive' ? 1 : input.polarity === 'negative' ? -1 : 0;
  if (sign === 0)
    return { status: 'unverifiable', reason: 'Arah indikator ini tidak dinyatakan positif atau negatif.' };
  if (pairs.length < 2)
    return { status: 'unverifiable', reason: 'Nilai sumber tidak cukup untuk diperiksa.' };

  // Monotonic in raw value: checking each step between consecutive distinct raw values suffices.
  pairs.sort((a, b) => a.raw - b.raw);
  const against: string[] = [];
  for (let index = 1; index < pairs.length; index += 1) {
    const before = pairs[index - 1];
    const after = pairs[index];
    if (!before || !after || after.raw === before.raw) continue;
    if (sign * (after.score - before.score) < -SCORE_EPSILON) against.push(after.regionId);
  }
  if (against.length > 0) {
    return {
      status: 'inconsistent',
      reason: `${String(against.length)} skor komponen bergerak berlawanan dengan arah indikator (${input.polarity}).`,
      examples: against.slice(0, MAX_EXAMPLES),
    };
  }
  return { status: 'consistent', checked: pairs.length };
}
