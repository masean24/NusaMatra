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

/** Lines that make a citation of a Lab result say what was asked and whether a ranking exists. */
function citationDetails(record: CompositeEvidenceRecord): string[] {
  const weights = record.indicators
    .map((indicator) => `${indicator.label} ${bpsLabel(indicator.requestedBps)}`)
    .join(', ');
  const scope = scopeLabel(record.scope.provinceId, record.scope.provinceName);
  return [
    `Cakupan: ${scope}. Bobot diminta: ${weights}.`,
    record.ranking === 'SHOWN'
      ? 'Peringkat: dikutip apa adanya dari Data Hub (skor tinggi = kebutuhan intervensi tinggi).'
      : 'Peringkat: ditahan, tidak ada peringkat yang dinyatakan oleh catatan ini.',
  ];
}

function exportNote(record: CompositeEvidenceRecord): string {
  return record.ranking === 'SHOWN'
    ? `Unduh JSON memuat catatan lengkap: ${String(record.rows.length)} wilayah berperingkat dan ${String(record.insufficient.length)} wilayah tidak diperingkat, setiap respons Data Hub beserta permintaannya, dan semua batasan.`
    : 'Unduh JSON memuat catatan lengkap: alasan peringkat ditahan, setiap respons Data Hub beserta permintaannya, dan semua batasan. Tidak ada peringkat di dalamnya.';
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
    { id: 'paspor-atas', label: 'Ringkasan' },
    { id: 'paspor-keterpercayaan', label: 'Keterpercayaan' },
    { id: 'paspor-ringkasan', label: 'Hasil' },
    { id: 'paspor-status-sumber', label: 'Status sumber data' },
    { id: 'paspor-pemeriksaan', label: 'Pemeriksaan hasil' },
    { id: 'paspor-cakupan', label: 'Cakupan dan bobot' },
    { id: 'paspor-kriteria', label: 'Kriteria' },
    ...(shown
      ? [
          { id: 'paspor-peringkat', label: 'Peringkat' },
          { id: 'paspor-tidak-diperingkat', label: 'Tidak diperingkat' },
        ]
      : []),
    { id: 'paspor-sumber', label: 'Sumber data' },
    { id: 'batasan', label: `Batasan (${String(notes.length)})` },
  ];

  return (
    <PassportLayout
      record={record}
      kindLabel={`Lab Prioritas · ${scopeLabel(record.scope.provinceId, record.scope.provinceName)}`}
      notes={notes}
      agencies={agencies}
      toc={toc}
      citation={citation}
      exportNote={exportNote(record)}
      actions={actions}
    >
      <CompositeSummary record={record} />
      <FocusSection record={record} />
      <SourceStatusSection
        record={record}
        agencies={agencies}
        link={link}
        onCopyDigest={actions.copyDigest}
      />
      <IntegritySection record={record} />
      <ScopeSection record={record} />
      <CriteriaSection record={record} />
      {shown && <RankingSection record={record} />}
      {shown && <InsufficientSection record={record} />}
      <SourcesSection record={record} />
      <LimitationsSection record={record} notes={notes} />
    </PassportLayout>
  );
}
