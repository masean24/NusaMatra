import type { IconName } from '@/components/ui/Icon/Icon';

export type QuestionId = 'jelajahi' | 'bandingkan' | 'lab' | 'paspor';

export interface GuidedQuestion {
  readonly id: QuestionId;
  readonly eyebrow: string;
  readonly icon: IconName;
  /** The question as a visitor would ask it; the tab's name. */
  readonly question: string;
  /** One line under the question in the list (desktop). */
  readonly summary: string;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly [string, string, string];
  readonly cta: string;
  readonly to: string;
  readonly hint: string;
}

/**
 * "Guided Question Canvas" (owner mockup, 2026-10-26): four questions a visitor brings, each
 * answered by one feature. The previews beside them are illustrations, never live data.
 */
export const GUIDED_QUESTIONS: readonly GuidedQuestion[] = [
  {
    id: 'jelajahi',
    eyebrow: 'Jelajahi',
    icon: 'map',
    question: 'Bagaimana kondisi daerah saya?',
    summary: 'Lihat indikator satu wilayah beserta sumbernya.',
    title: 'Pilih wilayah di peta, lalu baca indikatornya',
    description:
      'Cari kabupaten atau kota, pilih di peta, lalu lihat nilai indikatornya lengkap dengan satuan, tahun, dan sumber data.',
    steps: ['Cari daerahmu', 'Pilih di peta', 'Baca indikator dan sumbernya'],
    cta: 'Jelajahi wilayah',
    to: '/jelajahi',
    hint: 'Coba ketuk titik A, B, atau C di peta.',
  },
  {
    id: 'bandingkan',
    eyebrow: 'Bandingkan',
    icon: 'compare',
    question: 'Apa perbedaan dua daerah?',
    summary: 'Sandingkan dua wilayah; perbedaannya ditulis dengan kata.',
    title: 'Pilih dua wilayah, lalu baca perbedaannya',
    description:
      'Nilai disandingkan hanya bila definisi, satuan, dan tahunnya sebanding. Jika tidak, perbandingan ditahan dan alasannya ditulis.',
    steps: ['Pilih wilayah A', 'Pilih wilayah B', 'Baca hasil dan catatannya'],
    cta: 'Bandingkan wilayah',
    to: '/bandingkan',
    hint: 'Hasil ditulis dengan kata, bukan hanya warna.',
  },
  {
    id: 'lab',
    eyebrow: 'Lab Prioritas',
    icon: 'lab',
    question: 'Daerah mana yang perlu perhatian lebih?',
    summary: 'Atur bobot kriteria dan lihat urutan bergeser.',
    title: 'Atur bobot kriteria, lalu lihat urutan bergeser',
    description:
      'Geser bobot tiap kriteria; totalnya selalu 100%. Urutan wilayah dihitung ulang, dan setiap skor bisa diurai menjadi kontribusinya.',
    steps: ['Pilih kriteria', 'Atur bobotnya', 'Baca urutan dan alasannya'],
    cta: 'Buka Lab Prioritas',
    to: '/lab-prioritas',
    hint: 'Urutan adalah simulasi bersyarat, bukan keputusan resmi.',
  },
  {
    id: 'paspor',
    eyebrow: 'Paspor Bukti',
    icon: 'passport',
    question: 'Dari mana angka dan hasilnya berasal?',
    summary: 'Telusuri sumber, tahun, asumsi, dan batasan.',
    title: 'Periksa sumber, tahun, asumsi, dan batasannya',
    description:
      'Paspor Bukti merangkum satu hasil: pertanyaan, wilayah, bobot, model, sumber data, dan data yang belum tersedia.',
    steps: ['Buka Paspor Bukti', 'Periksa sumber dan tahun', 'Baca batasannya'],
    cta: 'Buka Paspor Bukti',
    to: '/paspor-bukti',
    hint: 'Setiap angka bisa ditelusuri ke sumbernya.',
  },
];
