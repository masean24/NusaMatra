import type { EvidenceRecord } from './evidenceTypes';
import { limitationList, type LimitationNote } from './limitationNote';
import { isSourceUnverified } from '@/features/data-hub';
import { snapshotIdentityNote, sourceLinksNote, unverifiedSourcesNote } from './notices';
import { t } from '@/lib/i18n';

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
      t('Data simulasi, bukan observasi resmi'),
      t(
        'Seluruh nilai dan nama pada catatan ini adalah data simulasi (DEMO) untuk mencoba aplikasi. Bukan observasi resmi dan tidak boleh dikutip sebagai fakta.',
      ),
    );
  }
  if (!record.source.consistent) {
    add(
      'Reproduksibilitas',
      t('Respons dari mode atau versi data berbeda'),
      t(
        'Respons Data Hub untuk catatan ini berasal dari mode atau versi data yang berbeda. Perbandingan antarwilayah tidak ditampilkan karena angkanya tidak setara.',
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
  if (record.source.referenceVersion) {
    add(
      'Reproduksibilitas',
      t('Tautan sumber dapat diperbaiki'),
      sourceLinksNote(record.source.referenceVersion),
    );
  }
  const unverified = record.indicators.filter((indicator) =>
    indicator.values.some((value) => value && isSourceUnverified(value.source.sourceVerification)),
  );
  if (unverified.length > 0) {
    add(
      'Data',
      t('Sebagian angka belum dicocokkan dengan sumber'),
      unverifiedSourcesNote(unverified.map((indicator) => indicator.label)),
    );
  }

  for (const coverage of record.coverage) {
    const name = nameOf(coverage.regionId);
    if (coverage.imputedCount > 0) {
      add(
        'Data',
        t('{0}: sebagian nilai adalah estimasi provinsi', name),
        t(
          '{0}: {1} nilai diimputasi dari tingkat provinsi (IMPUTED_PROVINCE). Itu bukan pengukuran kabupaten/kota, berapa pun kelengkapan indikatornya.',
          name,
          String(coverage.imputedCount),
        ),
      );
    }
    if (coverage.indicatorsWithoutValue > 0) {
      add(
        'Cakupan',
        t('{0}: ada indikator tanpa nilai', name),
        t(
          '{0}: {1} indikator tidak memiliki nilai pada versi data ini. Nilai kosong tidak dihitung sebagai nol.',
          name,
          String(coverage.indicatorsWithoutValue),
        ),
      );
    }
    const unclassified = coverage.byClass.UNSPECIFIED ?? 0;
    if (unclassified > 0) {
      add(
        'Data',
        t('{0}: ada nilai yang belum tergolong', name),
        t(
          '{0}: {1} nilai belum dapat digolongkan (penanda kualitas tidak ada atau katalog tidak termuat).',
          name,
          String(unclassified),
        ),
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
      t('Tahun data berbeda antarindikator'),
      t(
        'Tahun data berbeda antarindikator ({0} sampai {1}). Setiap nilai mencantumkan tahunnya sendiri.',
        String(sorted[0]),
        String(sorted[sorted.length - 1]),
      ),
    );
  }

  const unitWarnings = record.indicators.filter((indicator) => indicator.unitWarning !== null);
  for (const indicator of unitWarnings) {
    add(
      'Metode',
      t('{0}: satuan perlu dicermati', indicator.label),
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
        t('Sebagian indikator tidak dibandingkan'),
        t(
          '{0} indikator tidak dibandingkan secara numerik karena tidak setara (nilai kosong, satuan atau dataset berbeda, atau nilai imputasi). Nilainya tetap ditampilkan terpisah.',
          String(blocked.length),
        ),
      );
    }
    add(
      'Metode',
      t('Selisih bukan penilaian atau penyebab'),
      t(
        'Selisih yang tampil adalah selisih yang teramati. Nilai lebih tinggi tidak otomatis berarti lebih baik atau lebih buruk, dan selisih tidak menjelaskan penyebab.',
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
    t('Tanpa bobot, skor gabungan, atau peringkat'),
    t(
      'Catatan ini tidak memuat bobot, skor gabungan, peringkat, atau uji ketahanan. Nilai indikator di sini adalah nilai yang diterima dari Data Hub, tanpa dihitung ulang.',
    ),
  );
  return notes;
}

/** The record's `limitations`: the texts of `buildLimitationNotes`, in the same order. */
export function buildLimitations(record: Omit<EvidenceRecord, 'limitations'>): string[] {
  return buildLimitationNotes(record).map((note) => note.text);
}
