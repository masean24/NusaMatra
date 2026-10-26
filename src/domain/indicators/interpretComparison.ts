import type { ComparisonAssessment } from '@/domain/comparability';
import { isPolarity, polarityReading } from './interpretIndicator';

export interface ComparisonReadingInput {
  readonly indicatorLabel: string;
  readonly polarity: string;
  readonly nameA: string;
  readonly nameB: string;
  readonly assessment: ComparisonAssessment;
  /** Unit label shown after absolute gaps, e.g. "tahun" or "%"; empty when unknown. */
  readonly unitLabel: string;
  /**
   * Whether "N× lebih tinggi" is meaningful for the unit. It is for rates, scores and counts, not
   * for quantities like years, where a gap in years reads better than a ratio.
   */
  readonly useRatio: boolean;
  /** Formats a number the way the page does (Indonesian decimals). */
  readonly formatNumber: (value: number, digits: number) => string;
}

export type ComparisonVerdict = 'A_BETTER' | 'B_BETTER' | 'EQUAL' | 'NO_JUDGEMENT';

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
    return { verdict: 'EQUAL', sentence: `${indicatorLabel} ${nameA} dan ${nameB} sama.` };
  }

  const higher = difference.higher === 'A' ? nameA : nameB;
  const lower = difference.higher === 'A' ? nameB : nameA;
  const gap = unitLabel
    ? `${formatNumber(Math.abs(difference.absolute), 2)} ${unitLabel}`
    : formatNumber(Math.abs(difference.absolute), 2);
  const what =
    input.useRatio && difference.ratio !== null && difference.ratio >= 1.05
      ? `sekitar ${formatNumber(difference.ratio, 1)}× lebih tinggi`
      : `lebih tinggi ${gap}`;
  const parts = [`${indicatorLabel} ${higher} ${what} dibanding ${lower}.`];

  let verdict: ComparisonVerdict = 'NO_JUDGEMENT';
  const direction = polarityReading(polarity);
  if (direction !== null && isPolarity(polarity)) {
    parts.push(direction);
    const higherIsBetter = polarity === 'positive';
    const better = higherIsBetter ? higher : lower;
    verdict = better === nameA ? 'A_BETTER' : 'B_BETTER';
    parts.push(`Karena itu, ${better} berada pada kondisi yang relatif lebih baik pada indikator ini.`);
  } else {
    parts.push(
      'Arah baik atau buruk indikator ini belum ditetapkan, jadi tidak ada pihak yang dinilai lebih baik.',
    );
  }

  return { verdict, sentence: parts.join(' ') };
}
