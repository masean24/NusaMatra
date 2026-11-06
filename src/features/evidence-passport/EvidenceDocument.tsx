import { useLocation } from 'react-router';
import { buildCitation } from './citation';
import { shareablePassportPath } from './evidenceQuery';
import { buildExportPayload, exportFilename, serializeExport } from './exportRecord';
import type { EvidenceRecord } from './evidenceTypes';
import { IndicatorTables } from './IndicatorTables';
import { buildLimitationNotes } from './limitations';
import { PassportLayout, type TocEntry } from './PassportLayout';
import { agenciesOf } from './passportFormat';
import { RegionsSection } from './RegionsSection';
import { SourceStatusSection } from './SourceStatusSection';
import { LimitationsSection, SourcesSection } from './SourcesAndLimitations';
import { usePassportActions } from './usePassportActions';
import { t } from '@/lib/i18n';

const KIND_LABEL: Readonly<Record<EvidenceRecord['kind'], string>> = {
  wilayah: t('Satu wilayah'),
  bandingkan: t('Perbandingan dua wilayah'),
};

const EXPORT_NOTE = t(
  'Unduh JSON memuat catatan lengkap: setiap nilai indikator dengan sumber dan penandanya, setiap respons Data Hub beserta permintaannya, dan semua batasan.',
);

/** One region or one pair: how it is pinned, the regions, every indicator value, the sources, the limits. */
export function EvidenceDocument({ record }: { readonly record: EvidenceRecord }) {
  const { search } = useLocation();
  // Names the pinned snapshot, so the copied, shared or exported link reopens the same data.
  const link = `${window.location.origin}${shareablePassportPath(search, record.source)}`;
  const notes = buildLimitationNotes(record);
  const agencies = agenciesOf(record);
  const citation = buildCitation(record, link);
  const actions = usePassportActions({
    title: record.title,
    link,
    filename: exportFilename(record),
    buildCitationText: () => citation,
    buildExportText: () => serializeExport(buildExportPayload(record, link)),
  });
  const toc: TocEntry[] = [
    { id: 'paspor-atas', label: t('Ringkasan') },
    { id: 'paspor-keterpercayaan', label: t('Keterpercayaan') },
    { id: 'paspor-status-sumber', label: t('Status sumber data') },
    { id: 'paspor-wilayah', label: t('Wilayah') },
    { id: 'paspor-indikator', label: t('Indikator') },
    { id: 'paspor-sumber', label: t('Sumber data') },
    { id: 'batasan', label: t('Batasan ({0})', String(notes.length)) },
  ];

  return (
    <PassportLayout
      record={record}
      kindLabel={KIND_LABEL[record.kind]}
      notes={notes}
      agencies={agencies}
      toc={toc}
      citation={citation}
      exportNote={EXPORT_NOTE}
      actions={actions}
      wide={
        <>
          <IndicatorTables record={record} />
          <SourcesSection record={record} />
          <LimitationsSection record={record} notes={notes} />
        </>
      }
    >
      <SourceStatusSection record={record} agencies={agencies} />
      <RegionsSection record={record} />
    </PassportLayout>
  );
}
