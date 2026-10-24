import { useLocation } from 'react-router';
import { buildCitation } from './citation';
import { EvidenceActions } from './EvidenceActions';
import { shareablePassportPath } from './evidenceQuery';
import { EvidenceHeader } from './EvidenceHeader';
import { buildExportPayload, exportFilename, serializeExport } from './exportRecord';
import type { EvidenceRecord } from './evidenceTypes';
import { IndicatorTables } from './IndicatorTables';
import { RegionsSection } from './RegionsSection';
import { SourceStatusSection } from './SourceStatusSection';
import { LimitationsSection, SourcesSection } from './SourcesAndLimitations';
import { PrintRunningHeader } from './PrintRunningHeader';
import styles from './EvidencePassport.module.css';

const KIND_LABEL: Readonly<Record<EvidenceRecord['kind'], string>> = {
  wilayah: 'Satu wilayah',
  bandingkan: 'Perbandingan dua wilayah',
};

/** One finished record, read top to bottom: what it is, where it came from, the evidence, the limits. */
export function EvidenceDocument({ record }: { readonly record: EvidenceRecord }) {
  const { search } = useLocation();
  // Names the pinned snapshot, so the copied, shared or exported link reopens the same data.
  const link = `${window.location.origin}${shareablePassportPath(search, record.source)}`;

  return (
    <article className={styles.document} aria-label={record.title}>
      <PrintRunningHeader source={record.source} />
      <EvidenceHeader record={record} kindLabel={KIND_LABEL[record.kind]} link={link} />
      <div className={styles.noPrint}>
        <EvidenceActions
          title={record.title}
          link={link}
          filename={exportFilename(record)}
          buildCitationText={() => buildCitation(record, link)}
          buildExportText={() => serializeExport(buildExportPayload(record, link))}
        />
      </div>
      <SourceStatusSection record={record} />
      <RegionsSection record={record} />
      <IndicatorTables record={record} />
      <SourcesSection record={record} />
      <LimitationsSection record={record} />
    </article>
  );
}
