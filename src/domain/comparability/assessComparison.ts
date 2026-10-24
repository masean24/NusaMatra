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
  /**
   * `false` when the source did not say which dataset or agency the value comes from (the Data Hub
   * then sends a placeholder). Two unknown sources are not "the same source". Defaults to `true`.
   */
  readonly provenanceKnown?: boolean;
  /** `false` when the region has no entry for this indicator at all. Defaults to `true`. */
  readonly present?: boolean;
}

export type ComparisonBlockerCode =
  | 'MISSING_VALUE'
  | 'INCOMPATIBLE_UNIT'
  | 'INCOMPATIBLE_DEFINITION'
  | 'UNKNOWN_PROVENANCE'
  | 'IMPUTED_VALUE'
  | 'YEAR_MISMATCH'
  | 'YEAR_UNKNOWN';

/** Every problem blocks the difference now; no caveat-only case remains. */
export type ComparisonWarningCode = never;

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
  /** Reserved for caveats that do not block; none exist today. */
  readonly warnings: readonly ComparisonNote<ComparisonWarningCode>[];
  /** Present only when `allowed`. */
  readonly difference: ComparisonDifference | null;
}

const isImputed = (flag: string | null) => flag !== null && flag.startsWith('IMPUTED');
const isKnown = (side: ComparableMeasurement) => side.provenanceKnown !== false;
const isPresent = (side: ComparableMeasurement) => side.present !== false;

/**
 * A difference exists only when both values are real, in the same unit, from the same known
 * dataset, measured in the same known year and not imputed from the province. Any other pair keeps
 * its values but gets blockers explaining why no difference or better/worse reading is given.
 */
export function assessComparison(a: ComparableMeasurement, b: ComparableMeasurement): ComparisonAssessment {
  const blockers: ComparisonNote<ComparisonBlockerCode>[] = [];

  if (a.value === null || b.value === null) {
    blockers.push({
      code: 'MISSING_VALUE',
      message: 'Salah satu wilayah tidak memiliki data untuk indikator ini.',
    });
  }

  // A region without the indicator has no unit, dataset or year to compare: only "missing" applies.
  if (isPresent(a) && isPresent(b)) {
    if (a.unit !== b.unit) {
      blockers.push({
        code: 'INCOMPATIBLE_UNIT',
        message: `Satuan berbeda (${a.unit || 'tanpa satuan'} dan ${b.unit || 'tanpa satuan'}).`,
      });
    }
    if (!isKnown(a) || !isKnown(b)) {
      blockers.push({
        code: 'UNKNOWN_PROVENANCE',
        message: 'Sumber dataset salah satu angka tidak diketahui, jadi definisinya tidak dapat dicocokkan.',
      });
    } else if (a.datasetId !== b.datasetId) {
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
    if (a.value !== null && b.value !== null) {
      if (a.referenceYear === null || b.referenceYear === null) {
        blockers.push({
          code: 'YEAR_UNKNOWN',
          message: 'Tahun data salah satu wilayah tidak diketahui, jadi selisih tidak dihitung.',
        });
      } else if (a.referenceYear !== b.referenceYear) {
        blockers.push({
          code: 'YEAR_MISMATCH',
          message: `Tahun data berbeda (${String(a.referenceYear)} dan ${String(b.referenceYear)}), jadi selisih tidak dihitung.`,
        });
      }
    }
  }

  if (blockers.length > 0 || a.value === null || b.value === null) {
    return { allowed: false, blockers, warnings: [], difference: null };
  }

  const absolute = b.value - a.value;
  const smaller = Math.min(a.value, b.value);
  return {
    allowed: true,
    blockers,
    warnings: [],
    difference: {
      absolute,
      ratio: smaller > 0 ? Math.max(a.value, b.value) / smaller : null,
      higher: a.value === b.value ? 'EQUAL' : a.value > b.value ? 'A' : 'B',
    },
  };
}
