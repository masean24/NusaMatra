import { FRONTEND_MIN_REQUESTED_WEIGHT_PCT } from '@/domain/prioritization';
import type { CompositeEvidenceRecord } from './compositeTypes';
import { snapshotIdentityNote } from './notices';

const percent = (value: number) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

/**
 * Caveats derived from the composite record itself. The wording never says a withheld result passed
 * a check, and it names who set each rule (the Data Hub, or Nusa Matra's own interface policy).
 */
export function buildCompositeLimitations(record: Omit<CompositeEvidenceRecord, 'limitations'>): string[] {
  const notes: string[] = [];
  const hasIssue = (code: string) => record.integrity.issues.some((issue) => issue.code === code);
  const labelOf = (indicatorId: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === indicatorId)?.label ?? indicatorId;

  if (record.source.dataMode === 'DEMO') {
    notes.push(
      'Seluruh nilai dan nama pada catatan ini adalah data simulasi (DEMO) untuk mencoba aplikasi. Bukan observasi resmi dan tidak boleh dikutip sebagai fakta.',
    );
  }

  notes.push(snapshotIdentityNote(record.source.reproducibility));

  if (record.withheldReason === 'INTEGRITY') {
    notes.push(
      'Peringkat ditahan: pemeriksaan konsistensi di peramban menemukan masalah yang memblokir (lihat "Pemeriksaan hasil"). Catatan ini tidak menyatakan hasil tersebut memenuhi pemeriksaan, dan tidak ada peringkat yang ditampilkan.',
    );
  } else if (record.withheldReason === 'DIRECTION_ANOMALY') {
    const named = record.direction.anomalies
      .map(
        ({ indicatorId, regionId, raw, score }) =>
          `${labelOf(indicatorId)} untuk wilayah ${regionId} (nilai mentah ${String(raw)}, skor terpublikasi ${String(score)})`,
      )
      .join('; ');
    notes.push(
      named
        ? `Peringkat ditahan: skor sumber ${named} tidak sesuai dengan nilai mentahnya (penanda kualitas IMPUTED_PROVINCE: estimasi tingkat provinsi), dan wilayah itu ikut dihitung dengan bobot kriteria tersebut. Paspor ini tidak mengoreksi atau menghitung ulang skor itu dan tidak menampilkan peringkat.`
        : `Peringkat ditahan: skor komponen ${record.direction.inconsistentIndicatorIds.map(labelOf).join(', ')} bergerak berlawanan dengan arah indikatornya pada data sumber. Tidak ada peringkat yang ditampilkan.`,
    );
  } else if (record.withheldReason === 'MIXED_SOURCES') {
    notes.push(
      'Peringkat ditahan karena respons Data Hub untuk catatan ini berasal dari mode atau snapshot yang berbeda.',
    );
  } else {
    notes.push(
      `Pemeriksaan konsistensi di peramban tidak menemukan masalah yang memblokir (selisih terbesar antara skor dan jumlah komponennya ${record.integrity.maxScoreError.toFixed(3)}). Itu pemeriksaan konsistensi hasil Data Hub, bukan jaminan kebenaran data sumber.`,
    );
  }

  if (record.ranking === 'SHOWN' && record.direction.nationalRankWithheld) {
    notes.push(
      `Peringkat nasional tidak dicantumkan: skor sumber ${record.direction.anomalies.map(({ indicatorId, regionId }) => `${labelOf(indicatorId)} untuk wilayah ${regionId}`).join('; ')} (di luar daftar ini) tidak sesuai dengan nilai mentahnya, dan peringkat nasional dihitung bersama wilayah itu. Peringkat di dalam daftar ini tidak memakai wilayah tersebut.`,
    );
  }
  if (record.ranking === 'SHOWN' && record.direction.notFullyVerifiedIndicatorIds.length > 0) {
    notes.push(
      `Arah skor belum terverifikasi penuh terhadap data sumber untuk: ${record.direction.notFullyVerifiedIndicatorIds.map(labelOf).join(', ')}. Peringkat ditampilkan apa adanya dari Data Hub, bukan sebagai hasil yang terverifikasi penuh.`,
    );
  }

  if (hasIssue('PRESET_NOT_RANKABLE') && record.serverRankedCount > 0) {
    notes.push(
      `Anomali backend: Data Hub menandai skenario ini rankable = false, tetapi tetap mengembalikan peringkat untuk ${String(record.serverRankedCount)} wilayah. Paspor ini menahan peringkat itu dan tidak menampilkannya sebagai hasil yang sah.`,
    );
  }
  if (hasIssue('REQUESTED_WEIGHT_AVAILABILITY_LOW')) {
    const available = record.integrity.requestedWeightAvailabilityPct;
    notes.push(
      `Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub): peringkat ditahan bila kurang dari ${String(FRONTEND_MIN_REQUESTED_WEIGHT_PCT)}% bobot yang diminta berada pada indikator yang punya data nasional. Pada permintaan ini hanya ${available === null ? 'bagian yang tidak diketahui' : percent(available)} yang tersedia.`,
    );
  }

  notes.push(
    'Skor dan peringkat adalah hasil Data Hub apa adanya: paspor ini tidak menghitung ulang atau mengurutkan ulang. Data Hub tidak menyediakan kontribusi berbobot per kriteria, jadi tidak ditampilkan; yang tampil adalah skor kriteria tanpa bobot dan bobot yang dipakai tiap wilayah.',
  );
  if (record.ranking === 'SHOWN') {
    notes.push(record.scoreMeaning);
    notes.push(
      'Peringkat adalah posisi dalam daftar ini (sesuai cakupan provinsi bila ada); peringkat nasional adalah posisi di antara seluruh wilayah yang memenuhi syarat. Skor yang sama berbagi peringkat yang sama, sebagaimana dikirim Data Hub.',
    );
  }

  if (record.unavailableIndicatorIds.length > 0) {
    notes.push(
      `Kriteria tanpa data nasional (${record.unavailableIndicatorIds.join(', ')}) dilewati untuk semua wilayah dan bobotnya dialihkan ke kriteria lain.`,
    );
  }
  if (record.ranking === 'SHOWN') {
    const { partial } = record.integrity.coverageTiers;
    if (partial > 0) {
      notes.push(
        `${String(partial)} wilayah berstatus parsial: sebagian kriteria tidak punya nilai, bobot dialihkan ke kriteria yang ada (bobot per wilayah ditampilkan), dan nilai kosong tidak dihitung sebagai nol.`,
      );
    }
    if (record.insufficient.length > 0) {
      notes.push(
        `${String(record.insufficient.length)} wilayah tidak diperingkat karena data tidak cukup. Wilayah itu tidak mendapat skor ataupun peringkat, dan bukan berarti skornya nol.`,
      );
    }
    const imputed = record.rows.filter((row) => row.imputedIndicators.length > 0).length;
    if (imputed > 0) {
      notes.push(
        `${String(imputed)} wilayah memuat nilai IMPUTED_PROVINCE: estimasi tingkat provinsi, bukan pengukuran kabupaten/kota. Ini fakta granularitas yang terpisah dari kelengkapan data (cakupan 100% tetap dapat memuat nilai imputasi).`,
      );
    }
  }

  if (record.preset === null) {
    notes.push(
      'Bobot ini tidak sama dengan skenario siap pakai Data Hub mana pun, jadi tidak ada penanda rankable yang dapat diperiksa.',
    );
  } else if (record.preset.rankable === null) {
    notes.push(
      `Skenario "${record.preset.label}" tidak dilengkapi informasi ketersediaan dari Data Hub, sehingga tidak dapat dipastikan dapat diperingkat.`,
    );
  }
  for (const gap of record.unavailableSources) {
    notes.push(
      `Data pendukung "${gap}" tidak dapat dimuat, sehingga bagian yang bergantung padanya ditandai belum tersedia.`,
    );
  }
  notes.push('Catatan ini tidak memuat uji ketahanan (sensitivitas) peringkat.');
  return notes;
}
