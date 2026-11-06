import { t } from '@/lib/i18n';

export interface QualityFlagDescription {
  readonly label: string;
  /** True when the reader should be careful with the number (not a direct kabupaten/kota measurement). */
  readonly caution: boolean;
}

/**
 * Plain-language label for the Data Hub's quality flag. A province-imputed figure is always named as
 * such so it is never read as a kabupaten/kota observation; unknown flags are shown as sent.
 */
export function describeQualityFlag(flag: string | null): QualityFlagDescription | null {
  if (flag === null) return null;
  if (flag.startsWith('IMPUTED')) {
    return { label: t('Imputasi provinsi, bukan observasi kab/kota'), caution: true };
  }
  switch (flag) {
    case 'VERIFIED':
      return { label: t('Terverifikasi'), caution: false };
    case 'DERIVED':
      return { label: t('Turunan (dihitung, bukan pengukuran langsung)'), caution: true };
    case 'DEMO_EXAMPLE':
      return { label: t('Contoh DEMO, bukan observasi resmi'), caution: true };
    default:
      return { label: t('Penanda kualitas: {0}', flag), caution: true };
  }
}
