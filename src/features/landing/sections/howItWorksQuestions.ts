import type { IconName } from '@/components/ui/Icon/Icon';
import { t } from '@/lib/i18n';

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
    eyebrow: t('Jelajahi'),
    icon: 'map',
    question: t('Bagaimana kondisi daerah saya?'),
    summary: t('Lihat indikator satu wilayah beserta sumbernya.'),
    title: t('Pilih wilayah di peta, lalu baca indikatornya'),
    description: t(
      'Cari kabupaten atau kota, pilih di peta, lalu lihat nilai indikatornya lengkap dengan satuan, tahun, dan sumber data.',
    ),
    steps: [t('Cari daerahmu'), t('Pilih di peta'), t('Baca indikator dan sumbernya')],
    cta: t('Jelajahi wilayah'),
    to: '/jelajahi',
    hint: t('Coba ketuk titik A, B, atau C di peta.'),
  },
  {
    id: 'bandingkan',
    eyebrow: t('Bandingkan'),
    icon: 'compare',
    question: t('Apa perbedaan dua daerah?'),
    summary: t('Sandingkan dua wilayah; perbedaannya ditulis dengan kata.'),
    title: t('Pilih dua wilayah, lalu baca perbedaannya'),
    description: t(
      'Nilai disandingkan hanya bila definisi, satuan, dan tahunnya sebanding. Jika tidak, perbandingan ditahan dan alasannya ditulis.',
    ),
    steps: [t('Pilih wilayah A'), t('Pilih wilayah B'), t('Baca hasil dan catatannya')],
    cta: t('Bandingkan wilayah'),
    to: '/bandingkan',
    hint: t('Hasil ditulis dengan kata, bukan hanya warna.'),
  },
  {
    id: 'lab',
    eyebrow: t('Lab Prioritas'),
    icon: 'lab',
    question: t('Daerah mana yang perlu perhatian lebih?'),
    summary: t('Atur bobot kriteria dan lihat urutan bergeser.'),
    title: t('Atur bobot kriteria, lalu lihat urutan bergeser'),
    description: t(
      'Geser bobot tiap kriteria; totalnya selalu 100%. Urutan wilayah dihitung ulang, dan setiap skor bisa diurai menjadi kontribusinya.',
    ),
    steps: [t('Pilih kriteria'), t('Atur bobotnya'), t('Baca urutan dan alasannya')],
    cta: t('Buka Lab Prioritas'),
    to: '/lab-prioritas',
    hint: t('Urutan adalah simulasi bersyarat, bukan keputusan resmi.'),
  },
  {
    id: 'paspor',
    eyebrow: t('Paspor Bukti'),
    icon: 'passport',
    question: t('Dari mana angka dan hasilnya berasal?'),
    summary: t('Telusuri sumber, tahun, asumsi, dan batasan.'),
    title: t('Periksa sumber, tahun, asumsi, dan batasannya'),
    description: t(
      'Paspor Bukti merangkum satu hasil: pertanyaan, wilayah, bobot, model, sumber data, dan data yang belum tersedia.',
    ),
    steps: [t('Buka Paspor Bukti'), t('Periksa sumber dan tahun'), t('Baca batasannya')],
    cta: t('Buka Paspor Bukti'),
    to: '/paspor-bukti',
    hint: t('Setiap angka bisa ditelusuri ke sumbernya.'),
  },
];
