import type { ComparisonAssessment, ComparisonDifference } from '@/domain/comparability';
import { gapIsBelow, ratioIsBelow } from './exactDecimal';
import { isPolarity, polarityReading } from './interpretIndicator';
import type { UnitKind } from './units';
import { t } from '@/lib/i18n';

export interface ComparisonReadingInput {
  readonly indicatorLabel: string;
  readonly polarity: string;
  readonly nameA: string;
  readonly nameB: string;
  readonly assessment: ComparisonAssessment;
  /** Unit label shown after absolute gaps, e.g. "tahun" or "%"; empty when unknown. */
  readonly unitLabel: string;
  /** Kind of the unit, which decides when a gap is small enough to read as nearly equal. */
  readonly unitKind: UnitKind;
  /**
   * Whether "N× lebih tinggi" is meaningful for the unit (see `ratioIsMeaningful`): for rates,
   * counts, money and ratios, not for indices, scores or years, which get the absolute gap.
   */
  readonly useRatio: boolean;
  /** Formats a number the way the page does (Indonesian decimals). */
  readonly formatNumber: (value: number, digits: number) => string;
}

/**
 * Two values whose larger is under 5% above the smaller are read as nearly equal: the row says
 * "Hampir sama" and neither side is called (or coloured) better, since a gap that small is within
 * what a change of method or rounding could produce.
 */
export const SIMILAR_RATIO = 1.05;

/**
 * Years are judged by the gap itself, not its share: 2 years of life expectancy is under 5% of 70,
 * yet a real difference. Below a tenth of a year (about five weeks) the gap is read as nearly equal.
 */
export const SIMILAR_YEARS = 0.1;

/**
 * Whether a difference is small enough to read as "Hampir sama", for this kind of unit. Strictly
 * below the threshold, checked exactly on the two values (see `exactDecimal`): exactly 0.1 year or
 * exactly 5% is a difference, whatever binary floating point makes of the subtraction or division.
 */
export function isNearlyEqual(difference: ComparisonDifference, kind: UnitKind): boolean {
  if (difference.higher === 'EQUAL') return false;
  const { a, b } = difference;
  if (kind === 'years') return gapIsBelow(a, b, SIMILAR_YEARS);
  const smaller = Math.min(a, b);
  // No ratio below or at zero (as in `assessComparison`), so no "nearly equal" by ratio either.
  return smaller > 0 && ratioIsBelow(Math.max(a, b), smaller, SIMILAR_RATIO);
}

/**
 * Whether "N× lebih tinggi" says more than "1,0×" once rounded to the one decimal shown. A pair at
 * exactly 5% can have a binary ratio of 1.0499…, which would print as "1,0×"; it gets the gap in its
 * unit instead.
 */
export function showsAsMultiple(ratio: number | null): ratio is number {
  return ratio !== null && ratio.toFixed(1) !== '1.0';
}

/** `SIMILAR`: the values differ, but too little to call (see {@link isNearlyEqual}); no side is judged better. */
export type ComparisonVerdict = 'A_BETTER' | 'B_BETTER' | 'EQUAL' | 'SIMILAR' | 'NO_JUDGEMENT';

export interface ComparisonReading {
  readonly verdict: ComparisonVerdict;
  /** What differs, how direction reads for this indicator, and any limitation. */
  readonly sentence: string;
}

/**
 * Builds the sentence under a comparison row from verified values only. The "better" side is named
 * solely when polarity is defined, never from magnitude; one indicator never speaks for a region.
 */
export function readComparison(input: ComparisonReadingInput): ComparisonReading | null {
  const { assessment, nameA, nameB, indicatorLabel, polarity, unitLabel, formatNumber } = input;
  const difference = assessment.difference;
  if (!assessment.allowed || difference === null) return null;

  if (difference.higher === 'EQUAL') {
    return { verdict: 'EQUAL', sentence: t('{0} {1} dan {2} sama.', indicatorLabel, nameA, nameB) };
  }

  const higher = difference.higher === 'A' ? nameA : nameB;
  const lower = difference.higher === 'A' ? nameB : nameA;
  const gap = unitLabel
    ? `${formatNumber(Math.abs(difference.absolute), 2)} ${unitLabel}`
    : formatNumber(Math.abs(difference.absolute), 2);

  if (isNearlyEqual(difference, input.unitKind)) {
    return {
      verdict: 'SIMILAR',
      sentence: t(
        '{0} {1} dan {2} hampir sama (selisih {3}). Selisihnya sangat kecil, jadi tidak ada pihak yang dinilai lebih baik.',
        indicatorLabel,
        nameA,
        nameB,
        gap,
      ),
    };
  }

  const what =
    input.useRatio && showsAsMultiple(difference.ratio)
      ? t('sekitar {0}× lebih tinggi', formatNumber(difference.ratio, 1))
      : t('lebih tinggi {0}', gap);
  const parts = [t('{0} {1} {2} dibanding {3}.', indicatorLabel, higher, what, lower)];

  let verdict: ComparisonVerdict = 'NO_JUDGEMENT';
  const direction = polarityReading(polarity);
  if (direction !== null && isPolarity(polarity)) {
    parts.push(direction);
    const higherIsBetter = polarity === 'positive';
    const better = higherIsBetter ? higher : lower;
    verdict = better === nameA ? 'A_BETTER' : 'B_BETTER';
    parts.push(t('Karena itu, {0} berada pada kondisi yang relatif lebih baik pada indikator ini.', better));
  } else {
    parts.push(
      t('Arah baik atau buruk indikator ini belum ditetapkan, jadi tidak ada pihak yang dinilai lebih baik.'),
    );
  }

  return { verdict, sentence: parts.join(' ') };
}
