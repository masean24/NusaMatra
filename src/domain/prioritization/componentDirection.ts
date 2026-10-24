/**
 * Checks that a component score of the composite ranking points the way its indicator's polarity
 * says. Under the v2.1 contract (`score_direction: higher_is_need`, the default) a higher score means
 * higher need, so a "negative" indicator (poverty, hazard: a higher raw value is worse) must never give
 * a LOWER score as the raw value rises, and a "positive" one (HDI, safe water: a higher raw value is
 * better) must never give a HIGHER one. The pre-v2.1 orientation (`higher_is_better`) is the exact
 * opposite and is only supported to keep the old v1 evidence testable. With the national ranking it also
 * checks the component is the indicator's own published normalised score. Pure: detection only.
 *
 * Quality of the observations matters for HOW MUCH the raw-to-score order can be trusted:
 * - observations that are not `IMPUTED_PROVINCE` (VERIFIED, DERIVED, ...) are the independent evidence. They
 *   are always checked in full: one of them out of order makes the indicator `inconsistent`;
 * - an `IMPUTED_PROVINCE` observation is a province-level estimate. It is checked too, by fitting it between
 *   its independent neighbours. Only an imputed observation that does NOT fit is set aside; it is never
 *   hidden, but returned by id and value in a `partial` verdict ("unverified"). Production 2026-10-23: every
 *   observation of every indicator reproduces min-max from its displayed raw value (max error 0.005)
 *   except Lanny Jaya (9507) for `inf_safe_water_pct`, whose published score does not follow its raw value;
 * - when there are fewer than two independent observations the order cannot be established independently
 *   and the verdict is `unverified`, never `consistent`.
 */

export interface ReferenceValue {
  readonly raw: number | null;
  /** The indicator's published 0–100 normalised score for the region, if any. */
  readonly normalized: number | null;
  /** The Data Hub's quality flag for this observation (`VERIFIED`, `IMPUTED_PROVINCE`, `DERIVED`, ...). */
  readonly qualityFlag?: string | null;
}

export interface DirectionCheckInput {
  /** Backend vocabulary: "positive" | "negative" | other (not checkable). */
  readonly polarity: string;
  /** Component score per region, as the composite returned it. */
  readonly components: Readonly<Record<string, number | null>>;
  readonly reference: Readonly<Record<string, ReferenceValue>>;
  /**
   * Compare against the published normalised score too. Only valid for an unfiltered ranking under the
   * old contract; v2.1 normalises over the whole nation, also for a province-filtered ranking.
   */
  readonly compareToPublished: boolean;
  /**
   * Regions whose component in THIS ranking is an estimate (the composite's own `quality_flags`), in
   * addition to the flag the indicator's values carry in `reference`.
   */
  readonly imputedRegionIds?: ReadonlySet<string>;
  /** What a higher score means; defaults to the v2.1 contract. */
  readonly scoreDirection?: 'higher_is_need' | 'higher_is_better';
}

/** An imputed observation that does not follow the raw-to-score order of the independent ones. */
export interface UnverifiedObservation {
  readonly regionId: string;
  readonly raw: number;
  readonly score: number;
}

export type DirectionVerdict =
  /** Every observation, imputed ones included, follows the order; `imputedChecked` of them were estimates. */
  | { readonly status: 'consistent'; readonly checked: number; readonly imputedChecked: number }
  /** The independent observations follow the order; the listed imputed ones cannot be verified against it. */
  | {
      readonly status: 'partial';
      readonly checked: number;
      readonly unverified: readonly UnverifiedObservation[];
      readonly reason: string;
    }
  /** No independent observations to establish the order from: explicitly NOT verified. */
  | { readonly status: 'unverified'; readonly reason: string; readonly imputedCount: number }
  | { readonly status: 'inconsistent'; readonly reason: string; readonly examples: readonly string[] }
  | { readonly status: 'unverifiable'; readonly reason: string };

/** Component scores are rounded to 2 decimals; anything closer than this is equal. */
const SCORE_EPSILON = 0.011;
const MAX_EXAMPLES = 5;
/** Independent observations needed to establish an order at all. */
const MIN_INDEPENDENT = 2;
const IMPUTED_FLAG = 'IMPUTED_PROVINCE';

interface Pair {
  readonly regionId: string;
  readonly raw: number;
  readonly score: number;
}

/** Regions whose step to the next distinct raw value goes against `sign` (the first of each pair of the step). */
function orderBreaks(sortedPairs: readonly Pair[], sign: number): string[] {
  const against: string[] = [];
  for (let index = 1; index < sortedPairs.length; index += 1) {
    const before = sortedPairs[index - 1];
    const after = sortedPairs[index];
    if (!before || !after || after.raw === before.raw) continue;
    if (sign * (after.score - before.score) < -SCORE_EPSILON) against.push(after.regionId);
  }
  return against;
}

/** Does `candidate` sit between the independent observations just below and just above its raw value? */
function fitsBetween(candidate: Pair, independent: readonly Pair[], sign: number): boolean {
  let below: Pair | undefined;
  let above: Pair | undefined;
  for (const pair of independent) {
    if (pair.raw < candidate.raw && (!below || pair.raw > below.raw)) below = pair;
    if (pair.raw > candidate.raw && (!above || pair.raw < above.raw)) above = pair;
  }
  const lowerOk = !below || sign * (candidate.score - below.score) >= -SCORE_EPSILON;
  const upperOk = !above || sign * (above.score - candidate.score) >= -SCORE_EPSILON;
  return lowerOk && upperOk;
}

export function checkComponentDirection(input: DirectionCheckInput): DirectionVerdict {
  const independent: Pair[] = [];
  const imputed: Pair[] = [];
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
    if (reference.raw === null) continue;
    const pair = { regionId, raw: reference.raw, score };
    if (reference.qualityFlag === IMPUTED_FLAG || input.imputedRegionIds?.has(regionId)) imputed.push(pair);
    else independent.push(pair);
  }
  if (offPublished.length > 0) {
    return {
      status: 'inconsistent',
      reason: `${String(offPublished.length)} skor komponen berbeda dari skor ternormalisasi yang dipublikasikan untuk indikator ini.`,
      examples: offPublished.slice(0, MAX_EXAMPLES),
    };
  }

  // Expected sign of d(score)/d(raw): need-oriented scores rise with a "negative" indicator and fall with a "positive" one.
  const polaritySign = input.polarity === 'positive' ? 1 : input.polarity === 'negative' ? -1 : 0;
  const sign = (input.scoreDirection ?? 'higher_is_need') === 'higher_is_need' ? -polaritySign : polaritySign;
  if (sign === 0)
    return { status: 'unverifiable', reason: 'Arah indikator ini tidak dinyatakan positif atau negatif.' };
  if (independent.length + imputed.length < 2)
    return { status: 'unverifiable', reason: 'Nilai sumber tidak cukup untuk diperiksa.' };

  const byRaw = (a: Pair, b: Pair) => a.raw - b.raw;
  const inconsistent = (against: readonly string[]): DirectionVerdict => ({
    status: 'inconsistent',
    reason: `${String(against.length)} skor komponen bergerak berlawanan dengan arah indikator (${input.polarity}).`,
    examples: against.slice(0, MAX_EXAMPLES),
  });

  // Not enough independent observations: the order can only be tested among the estimates themselves, and
  // even if they agree the indicator is "unverified", not "consistent".
  if (independent.length < MIN_INDEPENDENT) {
    const against = orderBreaks([...independent, ...imputed].sort(byRaw), sign);
    if (against.length > 0) return inconsistent(against);
    return {
      status: 'unverified',
      imputedCount: imputed.length,
      reason: `Hanya ${String(independent.length)} pengamatan yang bukan estimasi; ${String(imputed.length)} nilai adalah estimasi tingkat provinsi. Urutan nilai mentah terhadap skor tidak dapat diverifikasi secara independen.`,
    };
  }

  // The independent observations are checked in full: one out of order fails the indicator.
  const sortedIndependent = [...independent].sort(byRaw);
  const against = orderBreaks(sortedIndependent, sign);
  if (against.length > 0) return inconsistent(against);

  // Each estimate is fitted between its independent neighbours. Only a misfit is set aside, and it is named.
  const unverified = imputed.filter((pair) => !fitsBetween(pair, sortedIndependent, sign));
  const checked = independent.length + imputed.length - unverified.length;
  if (unverified.length > 0) {
    return {
      status: 'partial',
      checked,
      unverified,
      reason: `${String(unverified.length)} nilai estimasi tingkat provinsi tidak mengikuti urutan nilai mentah pengamatan lain; skornya tidak dapat diverifikasi terhadap nilai mentahnya.`,
    };
  }
  return { status: 'consistent', checked, imputedChecked: imputed.length };
}
