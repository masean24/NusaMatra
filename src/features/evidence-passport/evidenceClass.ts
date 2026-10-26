import { qualityFlagNote } from '@/features/data-hub';

/**
 * How much a reader may rely on one value, in the four classes the Paspor Bukti distinguishes plus
 * two honest fall-backs. A class is always derived from what the Data Hub sent, never assumed:
 *
 * - `VERIFIED`: the Data Hub flags the value `VERIFIED` and the catalog lists the indicator as a
 *   direct source figure. The flag is the server's statement, not an independent check.
 * - `DERIVED`: the catalog says the indicator is computed by the Data Hub (`availability_status`).
 *   This needs the catalog join; without the catalog it cannot be told apart from `VERIFIED`.
 * - `IMPUTED_PROVINCE`: filled in from the province value, not measured for this kabupaten/kota.
 * - `DEMO_EXAMPLE`: simulated example value; never an observation.
 * - `OTHER_FLAG`: any other flag, shown exactly as the server sent it.
 * - `UNSPECIFIED`: no flag, or the class cannot be decided from the data at hand.
 */
export type EvidenceClass =
  'VERIFIED' | 'DERIVED' | 'IMPUTED_PROVINCE' | 'DEMO_EXAMPLE' | 'OTHER_FLAG' | 'UNSPECIFIED';

export interface ClassificationInput {
  /** The Data Hub's `quality_flag`, as sent. */
  readonly flag: string | null;
  /** The mapper's verdict that the value is a simulated DEMO example. */
  readonly isDemoExample: boolean;
  /** `availability_status` from the catalog ("DIRECT" | "DERIVED" | ...); `null` = indicator not in the catalog. */
  readonly catalogAvailability: string | null;
  /** Whether the catalog could be loaded at all. */
  readonly catalogLoaded: boolean;
}

export interface Classification {
  readonly evidenceClass: EvidenceClass;
  /** What a reader must know that the class label alone does not say; `null` = nothing to add. */
  readonly note: string | null;
}

export function classifyEvidence({
  flag,
  isDemoExample,
  catalogAvailability,
  catalogLoaded,
}: ClassificationInput): Classification {
  if (isDemoExample || flag === 'DEMO_EXAMPLE') {
    return { evidenceClass: 'DEMO_EXAMPLE', note: 'Nilai contoh simulasi, bukan observasi resmi.' };
  }
  if (flag === 'IMPUTED_PROVINCE') {
    return { evidenceClass: 'IMPUTED_PROVINCE', note: qualityFlagNote(flag) };
  }
  if (flag === 'VERIFIED') {
    if (!catalogLoaded) {
      return {
        evidenceClass: 'UNSPECIFIED',
        note: 'Data Hub menandainya sebagai angka sumber, tetapi katalog indikator tidak termuat sehingga tidak dapat dibedakan dari hasil hitungan.',
      };
    }
    if (catalogAvailability === 'DERIVED') {
      return {
        evidenceClass: 'DERIVED',
        note: 'Dihitung oleh Data Hub dari data lain, meski ditandai sebagai angka sumber.',
      };
    }
    if (catalogAvailability === null) {
      return {
        evidenceClass: 'UNSPECIFIED',
        note: 'Data Hub menandainya sebagai angka sumber, tetapi indikator ini tidak ada di katalog sehingga asalnya tidak dapat dipastikan.',
      };
    }
    return { evidenceClass: 'VERIFIED', note: null };
  }
  if (flag !== null) {
    return { evidenceClass: 'OTHER_FLAG', note: qualityFlagNote(flag) };
  }
  return { evidenceClass: 'UNSPECIFIED', note: 'Penanda kualitas belum tersedia dari Data Hub.' };
}

/** Plain-language names; the Data Hub's own codes stay in the data, never in the reader's way. */
const CLASS_LABEL: Readonly<Record<EvidenceClass, string>> = {
  VERIFIED: 'Angka langsung dari sumber',
  DERIVED: 'Hasil hitungan',
  IMPUTED_PROVINCE: 'Perkiraan dari provinsi',
  DEMO_EXAMPLE: 'Contoh simulasi',
  OTHER_FLAG: 'Penanda lain',
  UNSPECIFIED: 'Belum dinyatakan',
};

const CLASS_MEANING: Readonly<Record<EvidenceClass, string>> = {
  VERIFIED: 'Penanda dari Data Hub; bukan pemeriksaan independen oleh Nusa Matra.',
  DERIVED: 'Dihitung oleh Data Hub dari data lain, bukan angka yang dilaporkan langsung oleh sumber.',
  IMPUTED_PROVINCE: 'Diimputasi dari nilai provinsi; bukan pengukuran kabupaten/kota.',
  DEMO_EXAMPLE: 'Contoh simulasi; bukan observasi resmi.',
  OTHER_FLAG: 'Penanda kualitas lain dari Data Hub, ditampilkan apa adanya.',
  UNSPECIFIED: 'Data Hub tidak menyatakan atau tidak cukup menyatakan kelas nilai ini.',
};

/** Plain names for server flags outside the passport's classes; any other code is shown as sent. */
const OTHER_FLAG_NAME: Readonly<Record<string, string>> = {
  DERIVED: 'hasil hitungan',
  ESTIMATED: 'perkiraan',
  PROVISIONAL: 'angka sementara',
  PARTIAL: 'sebagian',
};

/** Label of the class; for another server flag, a plain-language lead and the flag in words. */
export function evidenceClassLabel(evidenceClass: EvidenceClass, rawFlag: string | null): string {
  if (evidenceClass === 'OTHER_FLAG' && rawFlag) {
    return `Penanda lain: ${OTHER_FLAG_NAME[rawFlag] ?? rawFlag}`;
  }
  return CLASS_LABEL[evidenceClass];
}

export function evidenceClassMeaning(evidenceClass: EvidenceClass): string {
  return CLASS_MEANING[evidenceClass];
}

export const EVIDENCE_CLASS_ORDER: readonly EvidenceClass[] = [
  'VERIFIED',
  'DERIVED',
  'IMPUTED_PROVINCE',
  'DEMO_EXAMPLE',
  'OTHER_FLAG',
  'UNSPECIFIED',
];
