import { useLocation } from 'react-router';
import { buildCitation } from './citation';
import { buildCompositeLimitationNotes } from './compositeLimitations';
import { InsufficientSection, RankingSection } from './CompositeRanking';
import { CriteriaSection, FocusSection, IntegritySection, ScopeSection } from './CompositeSections';
import { CompositeSummary } from './CompositeSummary';
import type { CompositeEvidenceRecord } from './compositeTypes';
import { shareablePassportPath } from './evidenceQuery';
import { buildExportPayload, exportFilename, serializeExport } from './exportRecord';
import { PassportLayout, type TocEntry } from './PassportLayout';
import { agenciesOf } from './passportFormat';
import { scopeLabel } from './scopeLabel';
import { SourceStatusSection } from './SourceStatusSection';
import { LimitationsSection, SourcesSection } from './SourcesAndLimitations';
import { usePassportActions } from './usePassportActions';
import { bpsLabel } from './weightLabel';
import { t } from '@/lib/i18n';

/** Lines that make a citation of a Lab result say what was asked and whether a ranking exists. */
function citationDetails(record: CompositeEvidenceRecord): string[] {
  const weights = record.indicators
    .map((indicator) => `${indicator.label} ${bpsLabel(indicator.requestedBps)}`)
    .join(', ');
  const scope = scopeLabel(record.scope.provinceId, record.scope.provinceName);
  return [
    t('Cakupan: {0}. Bobot diminta: {1}.', scope, weights),
    record.ranking === 'SHOWN'
      ? t('Peringkat: dikutip apa adanya dari Data Hub (skor tinggi = kebutuhan intervensi tinggi).')
      : t('Peringkat: ditahan, tidak ada peringkat yang dinyatakan oleh catatan ini.'),
  ];
}

function exportNote(record: CompositeEvidenceRecord): string {
  return record.ranking === 'SHOWN'
    ? t(
        'Unduh JSON memuat catatan lengkap: {0} wilayah berperingkat dan {1} wilayah tidak diperingkat, setiap respons Data Hub beserta permintaannya, dan semua batasan.',
        String(record.rows.length),
        String(record.insufficient.length),
      )
    : t(
        'Unduh JSON memuat catatan lengkap: alasan peringkat ditahan, setiap respons Data Hub beserta permintaannya, dan semua batasan. Tidak ada peringkat di dalamnya.',
      );
}

/**
 * A Lab result recorded as evidence: the answer, how it is pinned, how it was computed, the full
 * ranking, then the provenance and limits. The ranking tables exist only when the ranking is shown.
 */
export function CompositeDocument({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { search } = useLocation();
  // Names the pinned snapshot, so the copied, shared or exported link reopens the same data.
  const link = `${window.location.origin}${shareablePassportPath(search, record.source)}`;
  const notes = buildCompositeLimitationNotes(record);
  const agencies = agenciesOf(record);
  const citation = buildCitation(record, link, citationDetails(record));
  const actions = usePassportActions({
    title: record.title,
    link,
    filename: exportFilename(record),
    buildCitationText: () => citation,
    buildExportText: () => serializeExport(buildExportPayload(record, link)),
  });
  const shown = record.ranking === 'SHOWN';
  const toc: TocEntry[] = [
    { id: 'paspor-atas', label: t('Ringkasan') },
    { id: 'paspor-keterpercayaan', label: t('Keterpercayaan') },
    { id: 'paspor-ringkasan', label: t('Hasil') },
    { id: 'paspor-status-sumber', label: t('Status sumber data') },
    { id: 'paspor-pemeriksaan', label: t('Pemeriksaan hasil') },
    { id: 'paspor-cakupan', label: t('Cakupan dan bobot') },
    { id: 'paspor-kriteria', label: t('Kriteria') },
    ...(shown
      ? [
          { id: 'paspor-peringkat', label: t('Peringkat') },
          { id: 'paspor-tidak-diperingkat', label: t('Tidak diperingkat') },
        ]
      : []),
    { id: 'paspor-sumber', label: t('Sumber data') },
    { id: 'batasan', label: t('Batasan ({0})', String(notes.length)) },
  ];

  return (
    <PassportLayout
      record={record}
      kindLabel={t('Lab Prioritas, {0}', scopeLabel(record.scope.provinceId, record.scope.provinceName))}
      notes={notes}
      agencies={agencies}
      toc={toc}
      citation={citation}
      exportNote={exportNote(record)}
      actions={actions}
      wide={
        <>
          <IntegritySection record={record} />
          <ScopeSection record={record} />
          <CriteriaSection record={record} />
          {shown && <RankingSection record={record} />}
          {shown && <InsufficientSection record={record} />}
          <SourcesSection record={record} />
          <LimitationsSection record={record} notes={notes} />
        </>
      }
    >
      <CompositeSummary record={record} />
      <FocusSection record={record} />
      <SourceStatusSection record={record} agencies={agencies} />
    </PassportLayout>
  );
}
