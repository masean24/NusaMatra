import type { CompositeEvidenceRecord } from './compositeTypes';

/** Why a ranking is withheld, in one sentence; shared by the summary and the check section. */
export function withheldReasonText(record: CompositeEvidenceRecord): string {
  const blockers = record.integrity.issues.filter((issue) => issue.severity === 'block');
  switch (record.withheldReason) {
    case 'MIXED_SOURCES':
      return 'Respons Data Hub berasal dari mode atau snapshot yang berbeda.';
    case 'DIRECTION_ANOMALY':
      return 'Skor sumber Data Hub untuk kriteria yang dipakai tidak sesuai dengan nilai mentahnya. Hasil ini tidak boleh dibaca sebagai peringkat yang sah (lihat "Keterbatasan").';
    default:
      return `Pemeriksaan konsistensi di peramban menemukan ${String(blockers.length)} masalah yang memblokir. Hasil ini tidak boleh dibaca sebagai peringkat yang sah.`;
  }
}
