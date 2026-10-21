/**
 * Rule-based reading of one indicator value for ordinary users. Deterministic and explainable:
 * a condition is only called favorable or unfavorable when the indicator's polarity is defined
 * AND the Data Hub supplies a national percentile for the value. A bigger number is never judged
 * by magnitude alone, and anything unsupported stays neutral or "no judgement".
 */

export type IndicatorPolarity = 'positive' | 'negative';
export type ConditionVerdict = 'FAVORABLE' | 'UNFAVORABLE' | 'NEUTRAL' | 'NO_JUDGEMENT';

/**
 * The percentile the Data Hub sends is polarity-aligned (checked against the LIVE data: it rises
 * with the raw value for `positive` indicators and falls for `negative` ones), i.e. the share of
 * regions with data that this region is better than.
 */
export const FAVORABLE_FROM_PERCENT = 67;
export const UNFAVORABLE_UP_TO_PERCENT = 33;

export interface IndicatorReadingInput {
  /** Catalog polarity; anything other than positive/negative means the direction is not defined. */
  readonly polarity: string;
  /** National percentile (0–100), polarity-aligned; `null` when the Data Hub sends none. */
  readonly percentile: number | null;
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

  const better = rounded(input.percentile);
  if (input.percentile >= FAVORABLE_FROM_PERCENT) {
    return {
      verdict: 'FAVORABLE',
      label: 'Relatif lebih baik',
      explanation: `Lebih baik daripada sekitar ${better}% wilayah lain yang datanya tersedia pada snapshot ini.`,
    };
  }
  if (input.percentile <= UNFAVORABLE_UP_TO_PERCENT) {
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
