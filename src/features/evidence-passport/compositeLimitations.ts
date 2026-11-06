import { FRONTEND_MIN_REQUESTED_WEIGHT_PCT } from '@/domain/prioritization';
import type { CompositeEvidenceRecord } from './compositeTypes';
import { limitationList, type LimitationNote } from './limitationNote';
import { snapshotIdentityNote } from './notices';
import { locale, t } from '@/lib/i18n';

const percent = (value: number) => `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

/**
 * Caveats derived from the composite record itself. The wording never says a withheld result passed
 * a check, and it names who set each rule (the Data Hub, or Nusa Matra's own interface policy).
 */
export function buildCompositeLimitationNotes(
  record: Omit<CompositeEvidenceRecord, 'limitations'>,
): LimitationNote[] {
  const { notes, add } = limitationList();
  const hasIssue = (code: string) => record.integrity.issues.some((issue) => issue.code === code);
  const labelOf = (indicatorId: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === indicatorId)?.label ?? indicatorId;

  if (record.source.dataMode === 'DEMO') {
    add(
      'Data',
      t('Data simulasi, bukan observasi resmi'),
      t(
        'Seluruh nilai dan nama pada catatan ini adalah data simulasi (DEMO) untuk mencoba aplikasi. Bukan observasi resmi dan tidak boleh dikutip sebagai fakta.',
      ),
    );
  }

  add(
    'Reproduksibilitas',
    record.source.reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
      ? t('Data terkunci, tetapi versi data bisa hilang')
      : t('Data tidak dikunci ke versi data'),
    snapshotIdentityNote(record.source.reproducibility),
  );

  if (record.withheldReason === 'INTEGRITY') {
    add(
      'Metode',
      t('Peringkat ditahan oleh pemeriksaan konsistensi'),
      t(
        'Peringkat ditahan: pemeriksaan konsistensi di peramban menemukan masalah yang memblokir (lihat "Pemeriksaan hasil"). Catatan ini tidak menyatakan hasil tersebut memenuhi pemeriksaan, dan tidak ada peringkat yang ditampilkan.',
      ),
    );
  } else if (record.withheldReason === 'DIRECTION_ANOMALY') {
    const named = record.direction.anomalies
      .map(({ indicatorId, regionId, raw, score }) =>
        t(
          '{0} untuk wilayah {1} (nilai mentah {2}, skor terpublikasi {3})',
          labelOf(indicatorId),
          regionId,
          String(raw),
          String(score),
        ),
      )
      .join('; ');
    add(
      'Data',
      t('Peringkat ditahan: skor sumber tidak sesuai nilai mentah'),
      named
        ? t(
            'Peringkat ditahan: skor sumber {0} tidak sesuai dengan nilai mentahnya (penanda kualitas IMPUTED_PROVINCE: estimasi tingkat provinsi), dan wilayah itu ikut dihitung dengan bobot kriteria tersebut. Paspor ini tidak mengoreksi atau menghitung ulang skor itu dan tidak menampilkan peringkat.',
            named,
          )
        : t(
            'Peringkat ditahan: skor komponen {0} bergerak berlawanan dengan arah indikatornya pada data sumber. Tidak ada peringkat yang ditampilkan.',
            record.direction.inconsistentIndicatorIds.map(labelOf).join(', '),
          ),
    );
  } else if (record.withheldReason === 'MIXED_SOURCES') {
    add(
      'Reproduksibilitas',
      t('Peringkat ditahan: respons dari versi data berbeda'),
      t(
        'Peringkat ditahan karena respons Data Hub untuk catatan ini berasal dari mode atau versi data yang berbeda.',
      ),
    );
  } else {
    add(
      'Metode',
      t('Konsistensi hasil bukan jaminan kebenaran data'),
      t(
        'Pemeriksaan konsistensi di peramban tidak menemukan masalah yang memblokir (selisih terbesar antara skor dan jumlah komponennya {0}). Itu pemeriksaan konsistensi hasil Data Hub, bukan jaminan kebenaran data sumber.',
        record.integrity.maxScoreError.toFixed(3),
      ),
    );
  }

  if (record.ranking === 'SHOWN' && record.direction.nationalRankWithheld) {
    add(
      'Data',
      t('Peringkat nasional tidak dicantumkan'),
      t(
        'Peringkat nasional tidak dicantumkan: skor sumber {0} (di luar daftar ini) tidak sesuai dengan nilai mentahnya, dan peringkat nasional dihitung bersama wilayah itu. Peringkat di dalam daftar ini tidak memakai wilayah tersebut.',
        record.direction.anomalies
          .map(({ indicatorId, regionId }) => t('{0} untuk wilayah {1}', labelOf(indicatorId), regionId))
          .join('; '),
      ),
    );
  }
  if (record.ranking === 'SHOWN' && record.direction.notFullyVerifiedIndicatorIds.length > 0) {
    add(
      'Metode',
      t('Arah skor belum diperiksa penuh'),
      t(
        'Arah skor belum terverifikasi penuh terhadap data sumber untuk: {0}. Peringkat ditampilkan apa adanya dari Data Hub, bukan sebagai hasil yang terverifikasi penuh.',
        record.direction.notFullyVerifiedIndicatorIds.map(labelOf).join(', '),
      ),
    );
  }

  if (hasIssue('PRESET_NOT_RANKABLE') && record.serverRankedCount > 0) {
    add(
      'Data',
      t('Anomali backend: skenario tidak dapat diperingkat'),
      t(
        'Anomali backend: Data Hub menandai skenario ini rankable = false, tetapi tetap mengembalikan peringkat untuk {0} wilayah. Paspor ini menahan peringkat itu dan tidak menampilkannya sebagai hasil yang sah.',
        String(record.serverRankedCount),
      ),
    );
  }
  if (hasIssue('REQUESTED_WEIGHT_AVAILABILITY_LOW')) {
    const available = record.integrity.requestedWeightAvailabilityPct;
    add(
      'Metode',
      t('Kebijakan antarmuka: bobot berdata terlalu sedikit'),
      t(
        'Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub): peringkat ditahan bila kurang dari {0}% bobot yang diminta berada pada indikator yang punya data nasional. Pada permintaan ini hanya {1} yang tersedia.',
        String(FRONTEND_MIN_REQUESTED_WEIGHT_PCT),
        available === null ? t('bagian yang tidak diketahui') : percent(available),
      ),
    );
  }

  add(
    'Metode',
    t('Skor dan peringkat ditampilkan apa adanya'),
    t(
      'Skor dan peringkat adalah hasil Data Hub apa adanya: paspor ini tidak menghitung ulang atau mengurutkan ulang. Data Hub tidak menyediakan kontribusi berbobot per kriteria, jadi tidak ditampilkan; yang tampil adalah skor kriteria tanpa bobot dan bobot yang dipakai tiap wilayah.',
    ),
  );
  if (record.ranking === 'SHOWN') {
    add('Metode', t('Arti skor dan peringkat'), record.scoreMeaning);
    add(
      'Metode',
      t('Peringkat daftar dan peringkat nasional'),
      t(
        'Peringkat adalah posisi dalam daftar ini (sesuai cakupan provinsi bila ada); peringkat nasional adalah posisi di antara seluruh wilayah yang memenuhi syarat. Skor yang sama berbagi peringkat yang sama, sebagaimana dikirim Data Hub.',
      ),
    );
  }

  if (record.unavailableIndicatorIds.length > 0) {
    add(
      'Cakupan',
      t('Kriteria tanpa data nasional dilewati'),
      t(
        'Kriteria tanpa data nasional ({0}) dilewati untuk semua wilayah dan bobotnya dialihkan ke kriteria lain.',
        record.unavailableIndicatorIds.join(', '),
      ),
    );
  }
  if (record.ranking === 'SHOWN') {
    const { partial } = record.integrity.coverageTiers;
    if (partial > 0) {
      add(
        'Cakupan',
        t('Wilayah parsial, bobot dialihkan'),
        t(
          '{0} wilayah berstatus parsial: sebagian kriteria tidak punya nilai, bobot dialihkan ke kriteria yang ada (bobot per wilayah ditampilkan), dan nilai kosong tidak dihitung sebagai nol.',
          String(partial),
        ),
      );
    }
    if (record.insufficient.length > 0) {
      add(
        'Cakupan',
        t('Wilayah tanpa data cukup tidak diperingkat'),
        t(
          '{0} wilayah tidak diperingkat karena data tidak cukup. Wilayah itu tidak mendapat skor ataupun peringkat, dan bukan berarti skornya nol.',
          String(record.insufficient.length),
        ),
      );
    }
    const imputed = record.rows.filter((row) => row.imputedIndicators.length > 0).length;
    if (imputed > 0) {
      add(
        'Data',
        t('Sebagian nilai adalah estimasi provinsi'),
        t(
          '{0} wilayah memuat nilai IMPUTED_PROVINCE: estimasi tingkat provinsi, bukan pengukuran kabupaten/kota. Ini fakta granularitas yang terpisah dari kelengkapan data (cakupan 100% tetap dapat memuat nilai imputasi).',
          String(imputed),
        ),
      );
    }
  }

  if (record.preset === null) {
    add(
      'Metode',
      t('Bukan skenario siap pakai Data Hub'),
      t(
        'Bobot ini tidak sama dengan skenario siap pakai Data Hub mana pun, jadi tidak ada penanda rankable yang dapat diperiksa.',
      ),
    );
  } else if (record.preset.rankable === null) {
    add(
      'Metode',
      t('Ketersediaan skenario tidak diketahui'),
      t(
        'Skenario "{0}" tidak dilengkapi informasi ketersediaan dari Data Hub, sehingga tidak dapat dipastikan dapat diperingkat.',
        record.preset.label,
      ),
    );
  }
  for (const gap of record.unavailableSources) {
    add(
      'Cakupan',
      t('Data pendukung "{0}" tidak termuat', gap),
      t(
        'Data pendukung "{0}" tidak dapat dimuat, sehingga bagian yang bergantung padanya ditandai belum tersedia.',
        gap,
      ),
    );
  }
  add(
    'Metode',
    t('Tanpa uji ketahanan'),
    t('Catatan ini tidak memuat uji ketahanan (sensitivitas) peringkat.'),
  );
  return notes;
}

/** The record's `limitations`: the texts of `buildCompositeLimitationNotes`, in the same order. */
export function buildCompositeLimitations(record: Omit<CompositeEvidenceRecord, 'limitations'>): string[] {
  return buildCompositeLimitationNotes(record).map((note) => note.text);
}
