import type { EvidenceRecord } from './evidenceTypes';
import { limitationList, type LimitationNote } from './limitationNote';
import { snapshotIdentityNote } from './notices';

/**
 * The caveats a reader needs next to the numbers, derived from the record itself so none is boilerplate
 * that could contradict it. Indonesian, plain language, each under a short title for the page.
 */
export function buildLimitationNotes(record: Omit<EvidenceRecord, 'limitations'>): LimitationNote[] {
  const { notes, add } = limitationList();
  const nameOf = (regionId: string) =>
    record.regions.find((region) => region.regionId === regionId)?.name ?? regionId;

  if (record.source.dataMode === 'DEMO') {
    add(
      'Data',
      'Data simulasi, bukan observasi resmi',
      'Seluruh nilai dan nama pada catatan ini adalah data simulasi (DEMO) untuk mencoba aplikasi. Bukan observasi resmi dan tidak boleh dikutip sebagai fakta.',
    );
  }
  if (!record.source.consistent) {
    add(
      'Reproduksibilitas',
      'Respons dari mode atau versi data berbeda',
      'Respons Data Hub untuk catatan ini berasal dari mode atau versi data yang berbeda. Perbandingan antarwilayah tidak ditampilkan karena angkanya tidak setara.',
    );
  }

  add(
    'Reproduksibilitas',
    record.source.reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
      ? 'Data terkunci, tetapi versi data bisa hilang'
      : 'Data tidak dikunci ke versi data',
    snapshotIdentityNote(record.source.reproducibility),
  );

  for (const coverage of record.coverage) {
    const name = nameOf(coverage.regionId);
    if (coverage.imputedCount > 0) {
      add(
        'Data',
        `${name}: sebagian nilai adalah estimasi provinsi`,
        `${name}: ${String(coverage.imputedCount)} nilai diimputasi dari tingkat provinsi (IMPUTED_PROVINCE). Itu bukan pengukuran kabupaten/kota, berapa pun kelengkapan indikatornya.`,
      );
    }
    if (coverage.indicatorsWithoutValue > 0) {
      add(
        'Cakupan',
        `${name}: ada indikator tanpa nilai`,
        `${name}: ${String(coverage.indicatorsWithoutValue)} indikator tidak memiliki nilai pada versi data ini. Nilai kosong tidak dihitung sebagai nol.`,
      );
    }
    const unclassified = coverage.byClass.UNSPECIFIED ?? 0;
    if (unclassified > 0) {
      add(
        'Data',
        `${name}: ada nilai yang belum tergolong`,
        `${name}: ${String(unclassified)} nilai belum dapat digolongkan (penanda kualitas tidak ada atau katalog tidak termuat).`,
      );
    }
  }

  const years = new Set<number>();
  for (const indicator of record.indicators) {
    for (const value of indicator.values) {
      if (value?.status === 'AVAILABLE' && value.referenceYear !== null) years.add(value.referenceYear);
    }
  }
  if (years.size > 1) {
    const sorted = [...years].sort((a, b) => a - b);
    add(
      'Data',
      'Tahun data berbeda antarindikator',
      `Tahun data berbeda antarindikator (${String(sorted[0])} sampai ${String(sorted[sorted.length - 1])}). Setiap nilai mencantumkan tahunnya sendiri.`,
    );
  }

  const unitWarnings = record.indicators.filter((indicator) => indicator.unitWarning !== null);
  for (const indicator of unitWarnings) {
    add(
      'Metode',
      `${indicator.label}: satuan perlu dicermati`,
      `${indicator.label}: ${indicator.unitWarning ?? ''}`,
    );
  }

  if (record.kind === 'bandingkan') {
    const blocked = record.indicators.filter(
      (indicator) => indicator.comparison && !indicator.comparison.allowed,
    );
    if (blocked.length > 0) {
      add(
        'Metode',
        'Sebagian indikator tidak dibandingkan',
        `${String(blocked.length)} indikator tidak dibandingkan secara numerik karena tidak setara (nilai kosong, satuan atau dataset berbeda, atau nilai imputasi). Nilainya tetap ditampilkan terpisah.`,
      );
    }
    add(
      'Metode',
      'Selisih bukan penilaian atau penyebab',
      'Selisih yang tampil adalah selisih yang teramati. Nilai lebih tinggi tidak otomatis berarti lebih baik atau lebih buruk, dan selisih tidak menjelaskan penyebab.',
    );
  }

  for (const gap of record.unavailableSources) {
    add(
      'Cakupan',
      `Data pendukung "${gap}" tidak termuat`,
      `Data pendukung "${gap}" tidak dapat dimuat, sehingga bagian yang bergantung padanya ditandai belum tersedia.`,
    );
  }

  add(
    'Metode',
    'Tanpa bobot, skor gabungan, atau peringkat',
    'Catatan ini tidak memuat bobot, skor gabungan, peringkat, atau uji ketahanan. Nilai indikator di sini adalah nilai yang diterima dari Data Hub, tanpa dihitung ulang.',
  );
  return notes;
}

/** The record's `limitations`: the texts of `buildLimitationNotes`, in the same order. */
export function buildLimitations(record: Omit<EvidenceRecord, 'limitations'>): string[] {
  return buildLimitationNotes(record).map((note) => note.text);
}
