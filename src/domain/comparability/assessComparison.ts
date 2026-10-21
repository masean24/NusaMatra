/**
 * Decides whether two regions' values for the same indicator may be compared, and what the
 * difference is. Pure: a blocked pair never gets a computed difference, so nothing downstream can
 * show a misleading number.
 */

export interface ComparableMeasurement {
  /** `null` = the source has no value for this region (never 0). */
  readonly value: number | null;
  readonly unit: string;
  readonly referenceYear: number | null;
  /** Dataset the value comes from; two datasets for one indicator can define it differently. */
  readonly datasetId: string;
  /** The Data Hub's quality flag, e.g. `VERIFIED` or `IMPUTED_PROVINCE`. */
  readonly qualityFlag: string | null;
}

export type ComparisonBlockerCode =
  'MISSING_VALUE' | 'INCOMPATIBLE_UNIT' | 'INCOMPATIBLE_DEFINITION' | 'IMPUTED_VALUE';

export type ComparisonWarningCode = 'YEAR_MISMATCH' | 'YEAR_UNKNOWN';

export interface ComparisonNote<Code extends string> {
  readonly code: Code;
  /** Indonesian, shown next to the row. */
  readonly message: string;
}

export interface ComparisonDifference {
  /** b − a, in the indicator's unit. */
  readonly absolute: number;
  /** larger / smaller; only when both values are above 0, otherwise `null`. */
  readonly ratio: number | null;
  /** Which region has the higher figure. Higher is not better or worse: that depends on the indicator. */
  readonly higher: 'A' | 'B' | 'EQUAL';
}

export interface ComparisonAssessment {
  readonly allowed: boolean;
  readonly blockers: readonly ComparisonNote<ComparisonBlockerCode>[];
  readonly warnings: readonly ComparisonNote<ComparisonWarningCode>[];
  /** Present only when `allowed`. */
  readonly difference: ComparisonDifference | null;
}

const isImputed = (flag: string | null) => flag !== null && flag.startsWith('IMPUTED');

export function assessComparison(a: ComparableMeasurement, b: ComparableMeasurement): ComparisonAssessment {
  const blockers: ComparisonNote<ComparisonBlockerCode>[] = [];
  const warnings: ComparisonNote<ComparisonWarningCode>[] = [];

  if (a.value === null || b.value === null) {
    blockers.push({
      code: 'MISSING_VALUE',
      message: 'Salah satu wilayah tidak memiliki data untuk indikator ini.',
    });
  }
  if (a.unit !== b.unit) {
    blockers.push({
      code: 'INCOMPATIBLE_UNIT',
      message: `Satuan berbeda (${a.unit || 'tanpa satuan'} dan ${b.unit || 'tanpa satuan'}).`,
    });
  }
  if (a.datasetId !== b.datasetId) {
    blockers.push({
      code: 'INCOMPATIBLE_DEFINITION',
      message: 'Kedua angka berasal dari dataset dengan definisi yang bisa berbeda.',
    });
  }
  if (isImputed(a.qualityFlag) || isImputed(b.qualityFlag)) {
    blockers.push({
      code: 'IMPUTED_VALUE',
      message: 'Salah satu angka diimputasi dari nilai provinsi, bukan pengukuran kabupaten/kota.',
    });
  }

  if (a.referenceYear === null || b.referenceYear === null) {
    warnings.push({ code: 'YEAR_UNKNOWN', message: 'Tahun data salah satu wilayah tidak diketahui.' });
  } else if (a.referenceYear !== b.referenceYear) {
    warnings.push({
      code: 'YEAR_MISMATCH',
      message: `Tahun data berbeda (${String(a.referenceYear)} dan ${String(b.referenceYear)}).`,
    });
  }

  if (blockers.length > 0 || a.value === null || b.value === null) {
    return { allowed: false, blockers, warnings, difference: null };
  }

  const absolute = b.value - a.value;
  const smaller = Math.min(a.value, b.value);
  return {
    allowed: true,
    blockers,
    warnings,
    difference: {
      absolute,
      ratio: smaller > 0 ? Math.max(a.value, b.value) / smaller : null,
      higher: a.value === b.value ? 'EQUAL' : a.value > b.value ? 'A' : 'B',
    },
  };
}
