/**
 * Rule-based reading of one indicator value for ordinary users. Deterministic and explainable:
 * a condition is only called favorable or unfavorable when the indicator's polarity is defined,
 * the Data Hub supplies a national percentile for the value, AND what that percentile measures is
 * known. A bigger number is never judged by magnitude alone, and anything unsupported stays
 * "no judgement".
 */

export type IndicatorPolarity = 'positive' | 'negative';
export type ConditionVerdict = 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL' | 'NO_JUDGEMENT';

/**
 * What a national percentile counts:
 * - `BETTER_SHARE`: the share of regions with data that this region is better than.
 * - `NEED_SHARE`: the share of regions with data that have less need than this region (it rises
 *   as the condition gets worse, whatever the polarity).
 * - `UNVERIFIED`: not stated by the Data Hub, so no verdict may be drawn from it.
 */
export type PercentileOrientation = 'BETTER_SHARE' | 'NEED_SHARE' | 'UNVERIFIED';

/**
 * The Data Hub has not documented `national_percentile`, and its behaviour has changed: the
 * v1-era capture behaved as BETTER_SHARE (Lanny Jaya 9507, poverty 31,59 %: percentile 1,95), the
 * v2.1/v2.2 LIVE and the DEMO captures as NEED_SHARE (the same poverty value: 98,05, in the exact
 * order of the need-aligned normalized score). An undocumented field that flipped once is not a
 * basis for "better than X %". This stays the default for any response that does not state the
 * orientation. Contract v2.4 states it per response (`meta.score_direction: higher_is_need` on region
 * detail = a need percentile); the region panel then reads NEED_SHARE (see regionInsight).
 */
export const DATA_HUB_PERCENTILE_ORIENTATION: PercentileOrientation = 'UNVERIFIED';

export const FAVORABLE_FROM_PERCENT = 67;
export const UNFAVORABLE_UP_TO_PERCENT = 33;

export interface IndicatorReadingInput {
  /** Catalog polarity; anything other than positive/negative means the direction is not defined. */
  readonly polarity: string;
  /** National percentile (0–100) as the Data Hub sent it; `null` when it sends none. */
  readonly percentile: number | null;
  readonly percentileOrientation: PercentileOrientation;
  readonly qualityFlag: string | null;
  readonly hasValue: boolean;
}

export interface IndicatorReading {
  readonly verdict: ConditionVerdict;
  /** Short label for the badge. */
  readonly label: string;
  /** One or two sentences, Indonesian, with the basis and any limitation. */
  readonly explanation: string;
}

export function isPolarity(value: string): value is IndicatorPolarity {
  return value === 'positive' || value === 'negative';
}

/** What a higher or lower number means for this indicator. */
export function polarityReading(polarity: string): string | null {
  if (polarity === 'positive')
    return 'Nilai yang lebih tinggi menunjukkan kondisi yang lebih baik pada indikator ini.';
  if (polarity === 'negative')
    return 'Nilai yang lebih rendah menunjukkan kondisi yang lebih baik pada indikator ini.';
  return null;
}

const rounded = (percent: number) => String(Math.round(percent));

export function readIndicator(input: IndicatorReadingInput): IndicatorReading {
  if (!input.hasValue) {
    return {
      verdict: 'NO_JUDGEMENT',
      label: 'Data belum tersedia',
      explanation: 'Tidak ada nilai untuk dinilai.',
    };
  }
  if (input.qualityFlag !== null && input.qualityFlag.startsWith('IMPUTED')) {
    return {
      verdict: 'NO_JUDGEMENT',
      label: 'Tidak dinilai',
      explanation:
        'Nilai ini diimputasi dari tingkat provinsi, bukan pengukuran kabupaten/kota, sehingga tidak dinilai.',
    };
  }
  if (!isPolarity(input.polarity)) {
    return {
      verdict: 'NO_JUDGEMENT',
      label: 'Tidak dinilai',
      explanation:
        'Arah baik atau buruk indikator ini belum ditetapkan, jadi nilainya tidak diberi penilaian.',
    };
  }
  if (input.percentile === null) {
    return {
      verdict: 'NO_JUDGEMENT',
      label: 'Tidak dinilai',
      explanation:
        'Data Hub tidak menyertakan pembanding nasional untuk nilai ini, jadi tidak diberi penilaian.',
    };
  }

  if (input.percentileOrientation === 'UNVERIFIED') {
    return {
      verdict: 'NO_JUDGEMENT',
      label: 'Tidak dinilai',
      explanation:
        'Data Hub belum menjelaskan arah persentil nasionalnya, jadi nilai ini belum dibandingkan dengan wilayah lain.',
    };
  }

  // Both orientations are read as "better than this share of regions".
  const betterShare =
    input.percentileOrientation === 'BETTER_SHARE' ? input.percentile : 100 - input.percentile;
  const better = rounded(betterShare);
  if (betterShare >= FAVORABLE_FROM_PERCENT) {
    return {
      verdict: 'FAVORABLE',
      label: 'Relatif lebih baik',
      explanation: `Lebih baik daripada sekitar ${better}% wilayah lain yang datanya tersedia pada snapshot ini.`,
    };
  }
  if (betterShare <= UNFAVORABLE_UP_TO_PERCENT) {
    return {
      verdict: 'UNFAVORABLE',
      label: 'Relatif kurang baik',
      explanation: `Hanya lebih baik daripada sekitar ${better}% wilayah lain yang datanya tersedia pada snapshot ini.`,
    };
  }
  return {
    verdict: 'NEUTRAL',
    label: 'Di sekitar tengah',
    explanation: `Berada di sekitar tengah: lebih baik daripada sekitar ${better}% wilayah lain yang datanya tersedia.`,
  };
}
