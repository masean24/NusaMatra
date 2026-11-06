import { localized, t } from '@/lib/i18n';

/**
 * Destinations that exist in the approved Figma but are not built in this slice. Each gets an
 * honest, branded page that says what the feature will do and that it is still in development.
 */
export interface FeatureShell {
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  /** What the finished feature will let people do, in plain language. */
  readonly plannedCapabilities: readonly string[];
  /** Figma frame of the finished design, for traceability. */
  readonly figmaNode: string | null;
  /** Map-first screens host the external 3D map (`Explore3DMapSlot`). */
  readonly hasMap?: boolean;
}

export const FEATURE_SHELLS = localized((): readonly FeatureShell[] => [
  {
    path: '/peta',
    title: t('Peta Utama'),
    summary: t('Titik awal untuk memilih jalur eksplorasi: wilayah, perbandingan, atau analisis prioritas.'),
    plannedCapabilities: [
      t('Melihat gambaran wilayah Indonesia pada peta ilustratif.'),
      t('Memilih jalur: menjelajah satu wilayah, membandingkan dua wilayah, atau membuka Lab Prioritas.'),
    ],
    figmaNode: '61:1183',
    hasMap: true,
  },
  {
    path: '/jelajahi',
    title: t('Jelajahi Wilayah'),
    summary: t('Cari kabupaten/kota, pilih di peta, lalu baca indikatornya beserta sumber dan tahunnya.'),
    plannedCapabilities: [
      t('Mencari kabupaten/kota berdasarkan nama resmi dan alias.'),
      t('Memilih wilayah lewat peta atau daftar yang dapat digunakan dengan papan ketik.'),
      t('Membaca nilai, satuan, periode, definisi, dan sumber setiap indikator.'),
    ],
    figmaNode: '29:34',
    hasMap: true,
  },
  {
    path: '/bandingkan',
    title: t('Bandingkan Wilayah'),
    summary: t(
      'Sandingkan dua wilayah dan baca perbedaannya dengan kata, lengkap dengan peringatan bila data tidak setara.',
    ),
    plannedCapabilities: [
      t('Memilih tepat dua wilayah dan menukar posisinya.'),
      t('Membandingkan indikator hanya bila definisi, satuan, dan metodenya setara.'),
      t('Menahan perhitungan selisih bila perbandingan bisa menyesatkan.'),
    ],
    figmaNode: '12:840',
  },
  {
    path: '/lab-prioritas',
    title: t('Lab Prioritas'),
    summary: t(
      'Atur bobot kriteria dan lihat bagaimana urutan wilayah bergeser, dengan alasan di balik setiap posisi.',
    ),
    plannedCapabilities: [
      t('Mengatur bobot kriteria dengan total selalu 100%.'),
      t('Melihat urutan wilayah yang dihitung ulang secara deterministik.'),
      t('Membuka penjelasan kontribusi setiap kriteria.'),
    ],
    figmaNode: '11:152',
  },
  {
    path: '/uji-rekomendasi',
    title: t('Uji Rekomendasi'),
    summary: t('Ganti asumsi dan periksa apakah urutan prioritas tetap bertahan.'),
    plannedCapabilities: [
      t('Menjalankan uji sensitivitas yang dapat diulang dengan seed yang sama.'),
      t('Melihat rentang peringkat setiap wilayah.'),
    ],
    figmaNode: '13:854',
  },
  {
    path: '/paspor-bukti',
    title: t('Paspor Bukti'),
    summary: t(
      'Catatan bukti satu wilayah, perbandingan, atau hasil Lab: sumber, tahun, penanda kualitas, dan batasannya. Dirangkai di peramban, bukan arsip resmi.',
    ),
    plannedCapabilities: [
      t('Menampilkan mode data dan snapshot yang terbaca dari respons Data Hub.'),
      t('Menyertakan sumber, tahun, penanda kualitas, dan data yang belum tersedia.'),
      t('Mencetak catatan atau mengunduhnya sebagai JSON.'),
    ],
    figmaNode: '13:446',
  },
  {
    path: '/cerita-wilayah',
    title: t('Cerita Wilayah'),
    summary: t(
      'Data yang rumit diceritakan bab demi bab, dengan visual yang bergerak mengikuti bacaan Anda.',
    ),
    plannedCapabilities: [
      t('Membaca narasi per bab dengan navigasi maju dan mundur.'),
      t('Membaca ringkasan teks setiap bab tanpa bergantung pada animasi.'),
    ],
    figmaNode: '14:927',
  },
  {
    path: '/titik-buta-data',
    title: t('Batasan Data'),
    summary: t('Daftar data yang kosong, tahunnya berbeda, atau metodenya tidak sebanding.'),
    plannedCapabilities: [
      t('Melihat setiap masalah kualitas data beserta wilayah dan indikator yang terdampak.'),
      t('Mengetahui apakah masalah itu memblokir perbandingan atau hanya peringatan.'),
    ],
    figmaNode: '14:541',
  },
  {
    path: '/metodologi',
    title: t('Cara Skor Dihitung'),
    summary: t(
      'Dari angka resmi sampai peringkat dalam tiga langkah, dengan contoh angka sungguhan dari Data Hub. Semua skor dihitung oleh Data Hub; halaman ini menjelaskan caranya.',
    ),
    plannedCapabilities: [
      t('Membaca rumus skor kebutuhan 0–100 dan skor gabungan Lab Prioritas.'),
      t('Melihat contoh perhitungan satu indikator untuk satu wilayah.'),
      t('Memahami cara data yang kosong ditangani.'),
    ],
    figmaNode: null,
  },
]);

export function findFeatureShell(path: string): FeatureShell | undefined {
  return FEATURE_SHELLS().find((shell) => shell.path === path);
}
