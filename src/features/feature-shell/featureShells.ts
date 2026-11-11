import { localized, t } from '@/lib/i18n';

/** A built page's address, its heading and lead, and the Figma frame of its design. */
export interface FeatureShell {
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  /** Figma frame of the design, for traceability. */
  readonly figmaNode: string | null;
}

export const FEATURE_SHELLS = localized((): readonly FeatureShell[] => [
  {
    path: '/jelajahi',
    title: t('Jelajahi Wilayah'),
    summary: t('Cari kabupaten/kota, pilih di peta, lalu baca indikatornya beserta sumber dan tahunnya.'),
    figmaNode: '29:34',
  },
  {
    path: '/bandingkan',
    title: t('Bandingkan Wilayah'),
    summary: t(
      'Sandingkan dua wilayah dan baca perbedaannya dengan kata, lengkap dengan peringatan bila data tidak setara.',
    ),
    figmaNode: '12:840',
  },
  {
    path: '/lab-prioritas',
    title: t('Lab Prioritas'),
    summary: t(
      'Atur bobot kriteria dan lihat bagaimana urutan wilayah bergeser, dengan alasan di balik setiap posisi.',
    ),
    figmaNode: '11:152',
  },
  {
    path: '/paspor-bukti',
    title: t('Paspor Bukti'),
    summary: t(
      'Catatan bukti satu wilayah, perbandingan, atau hasil Lab: sumber, tahun, penanda kualitas, dan batasannya. Dirangkai di peramban, bukan arsip resmi.',
    ),
    figmaNode: '13:446',
  },
  {
    path: '/metodologi',
    title: t('Cara Skor Dihitung'),
    summary: t(
      'Dari angka resmi sampai peringkat dalam tiga langkah, dengan contoh angka sungguhan dari Data Hub. Semua skor dihitung oleh Data Hub; halaman ini menjelaskan caranya.',
    ),
    figmaNode: null,
  },
]);

export function findFeatureShell(path: string): FeatureShell | undefined {
  return FEATURE_SHELLS().find((shell) => shell.path === path);
}
