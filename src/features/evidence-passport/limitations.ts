import type { EvidenceRecord } from './evidenceTypes';
import { SNAPSHOT_MUTABILITY_NOTE } from './notices';

/**
 * The caveats a reader needs next to the numbers, derived from the record itself so none is boilerplate
 * that could contradict it. Indonesian, plain language.
 */
export function buildLimitations(record: Omit<EvidenceRecord, 'limitations'>): string[] {
  const notes: string[] = [];
  const nameOf = (regionId: string) =>
    record.regions.find((region) => region.regionId === regionId)?.name ?? regionId;

  if (record.source.dataMode === 'DEMO') {
    notes.push(
      'Seluruh nilai dan nama pada catatan ini adalah data simulasi (DEMO) untuk mencoba aplikasi. Bukan observasi resmi dan tidak boleh dikutip sebagai fakta.',
    );
  }
  if (!record.source.consistent) {
    notes.push(
      'Respons Data Hub untuk catatan ini berasal dari mode atau snapshot yang berbeda. Perbandingan antarwilayah tidak ditampilkan karena angkanya tidak setara.',
    );
  }

  notes.push(SNAPSHOT_MUTABILITY_NOTE);

  for (const coverage of record.coverage) {
    const name = nameOf(coverage.regionId);
    if (coverage.imputedCount > 0) {
      notes.push(
        `${name}: ${String(coverage.imputedCount)} nilai diimputasi dari tingkat provinsi (IMPUTED_PROVINCE). Itu bukan pengukuran kabupaten/kota, berapa pun kelengkapan indikatornya.`,
      );
    }
    if (coverage.indicatorsWithoutValue > 0) {
      notes.push(
        `${name}: ${String(coverage.indicatorsWithoutValue)} indikator tidak memiliki nilai pada snapshot ini. Nilai kosong tidak dihitung sebagai nol.`,
      );
    }
    const unclassified = coverage.byClass.UNSPECIFIED ?? 0;
    if (unclassified > 0) {
      notes.push(
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
    notes.push(
      `Tahun data berbeda antarindikator (${String(sorted[0])} sampai ${String(sorted[sorted.length - 1])}). Setiap nilai mencantumkan tahunnya sendiri.`,
    );
  }

  const unitWarnings = record.indicators.filter((indicator) => indicator.unitWarning !== null);
  for (const indicator of unitWarnings) {
    notes.push(`${indicator.label}: ${indicator.unitWarning ?? ''}`);
  }

  if (record.kind === 'bandingkan') {
    const blocked = record.indicators.filter(
      (indicator) => indicator.comparison && !indicator.comparison.allowed,
    );
    if (blocked.length > 0) {
      notes.push(
        `${String(blocked.length)} indikator tidak dibandingkan secara numerik karena tidak setara (nilai kosong, satuan atau dataset berbeda, atau nilai imputasi). Nilainya tetap ditampilkan terpisah.`,
      );
    }
    notes.push(
      'Selisih yang tampil adalah selisih yang teramati. Nilai lebih tinggi tidak otomatis berarti lebih baik atau lebih buruk, dan selisih tidak menjelaskan penyebab.',
    );
  }

  for (const gap of record.unavailableSources) {
    notes.push(
      `Data pendukung "${gap}" tidak dapat dimuat, sehingga bagian yang bergantung padanya ditandai belum tersedia.`,
    );
  }

  notes.push(
    'Catatan ini tidak memuat bobot, skor gabungan, peringkat, atau uji ketahanan. Nilai indikator di sini adalah nilai yang diterima dari Data Hub, tanpa dihitung ulang.',
  );
  return notes;
}
