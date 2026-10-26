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

export const FEATURE_SHELLS: readonly FeatureShell[] = [
  {
    path: '/peta',
    title: 'Peta Utama',
    summary: 'Titik awal untuk memilih jalur eksplorasi: wilayah, perbandingan, atau analisis prioritas.',
    plannedCapabilities: [
      'Melihat gambaran wilayah Indonesia pada peta ilustratif.',
      'Memilih jalur: menjelajah satu wilayah, membandingkan dua wilayah, atau membuka Lab Prioritas.',
    ],
    figmaNode: '61:1183',
    hasMap: true,
  },
  {
    path: '/jelajahi',
    title: 'Jelajahi Wilayah',
    summary: 'Cari kabupaten/kota, pilih di peta, lalu baca indikatornya beserta sumber dan tahunnya.',
    plannedCapabilities: [
      'Mencari kabupaten/kota berdasarkan nama resmi dan alias.',
      'Memilih wilayah lewat peta atau daftar yang dapat digunakan dengan papan ketik.',
      'Membaca nilai, satuan, periode, definisi, dan sumber setiap indikator.',
    ],
    figmaNode: '29:34',
    hasMap: true,
  },
  {
    path: '/bandingkan',
    title: 'Bandingkan Wilayah',
    summary:
      'Sandingkan dua wilayah dan baca perbedaannya dengan kata, lengkap dengan peringatan bila data tidak setara.',
    plannedCapabilities: [
      'Memilih tepat dua wilayah dan menukar posisinya.',
      'Membandingkan indikator hanya bila definisi, satuan, dan metodenya setara.',
      'Menahan perhitungan selisih bila perbandingan bisa menyesatkan.',
    ],
    figmaNode: '12:840',
  },
  {
    path: '/lab-prioritas',
    title: 'Lab Prioritas',
    summary:
      'Atur bobot kriteria dan lihat bagaimana urutan wilayah bergeser, dengan alasan di balik setiap posisi.',
    plannedCapabilities: [
      'Mengatur bobot kriteria dengan total selalu 100%.',
      'Melihat urutan wilayah yang dihitung ulang secara deterministik.',
      'Membuka penjelasan kontribusi setiap kriteria.',
    ],
    figmaNode: '11:152',
  },
  {
    path: '/uji-rekomendasi',
    title: 'Uji Rekomendasi',
    summary: 'Ganti asumsi dan periksa apakah urutan prioritas tetap bertahan.',
    plannedCapabilities: [
      'Menjalankan uji sensitivitas yang dapat diulang dengan seed yang sama.',
      'Melihat rentang peringkat setiap wilayah.',
    ],
    figmaNode: '13:854',
  },
  {
    path: '/paspor-bukti',
    title: 'Paspor Bukti',
    summary:
      'Catatan bukti satu wilayah, perbandingan, atau hasil Lab: sumber, tahun, penanda kualitas, dan batasannya. Dirangkai di peramban, bukan arsip resmi.',
    plannedCapabilities: [
      'Menampilkan mode data dan snapshot yang terbaca dari respons Data Hub.',
      'Menyertakan sumber, tahun, penanda kualitas, dan data yang belum tersedia.',
      'Mencetak catatan atau mengunduhnya sebagai JSON.',
    ],
    figmaNode: '13:446',
  },
  {
    path: '/cerita-wilayah',
    title: 'Cerita Wilayah',
    summary: 'Data yang rumit diceritakan bab demi bab, dengan visual yang bergerak mengikuti bacaan Anda.',
    plannedCapabilities: [
      'Membaca narasi per bab dengan navigasi maju dan mundur.',
      'Membaca ringkasan teks setiap bab tanpa bergantung pada animasi.',
    ],
    figmaNode: '14:927',
  },
  {
    path: '/titik-buta-data',
    title: 'Batasan Data',
    summary: 'Daftar data yang kosong, tahunnya berbeda, atau metodenya tidak sebanding.',
    plannedCapabilities: [
      'Melihat setiap masalah kualitas data beserta wilayah dan indikator yang terdampak.',
      'Mengetahui apakah masalah itu memblokir perbandingan atau hanya peringatan.',
    ],
    figmaNode: '14:541',
  },
  {
    path: '/metodologi',
    title: 'Metodologi',
    summary: 'Cara Nusa Matra menormalkan indikator, menghitung skor, dan menangani data yang hilang.',
    plannedCapabilities: [
      'Membaca rumus skor dan kebijakan data hilang yang sudah disetujui.',
      'Melihat versi model yang dipakai setiap analisis.',
    ],
    figmaNode: null,
  },
];

export function findFeatureShell(path: string): FeatureShell | undefined {
  return FEATURE_SHELLS.find((shell) => shell.path === path);
}
