import { useLocation } from 'react-router';
import { buildCitation } from './citation';
import { bpsLabel } from './weightLabel';
import { InsufficientSection, RankingSection } from './CompositeRanking';
import { CriteriaSection, FocusSection, IntegritySection, ScopeSection } from './CompositeSections';
import type { CompositeEvidenceRecord } from './compositeTypes';
import { EvidenceActions } from './EvidenceActions';
import { scopeLabel } from './scopeLabel';
import { EvidenceHeader } from './EvidenceHeader';
import { buildExportPayload, exportFilename, serializeExport } from './exportRecord';
import { SourceStatusSection } from './SourceStatusSection';
import { LimitationsSection, SourcesSection } from './SourcesAndLimitations';
import { PrintRunningHeader } from './PrintRunningHeader';
import styles from './EvidencePassport.module.css';

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

/** A Lab result recorded as evidence. The ranking tables exist only when the ranking is shown. */
export function CompositeDocument({ record }: { readonly record: CompositeEvidenceRecord }) {
  const { pathname, search } = useLocation();
  const link = `${window.location.origin}${pathname}${search}`;

  return (
    <article className={styles.document} aria-label={record.title}>
      <PrintRunningHeader source={record.source} />
      <EvidenceHeader record={record} kindLabel="Hasil Lab Prioritas" link={link} />
      <div className={styles.noPrint}>
        <EvidenceActions
          title={record.title}
          link={link}
          filename={exportFilename(record)}
          buildCitationText={() => buildCitation(record, link, citationDetails(record))}
          buildExportText={() => serializeExport(buildExportPayload(record, link))}
        />
      </div>
      <FocusSection record={record} />
      <SourceStatusSection record={record} />
      <ScopeSection record={record} />
      <IntegritySection record={record} />
      {record.ranking === 'SHOWN' && <RankingSection record={record} />}
      {record.ranking === 'SHOWN' && <InsufficientSection record={record} />}
      <CriteriaSection record={record} />
      <SourcesSection record={record} />
      <LimitationsSection record={record} />
    </article>
  );
}
