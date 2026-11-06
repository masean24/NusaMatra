import type { EvidenceBase, EvidenceSourceSummary } from './evidenceTypes';
import { formatBrowserTime } from './formatTime';
import { BROWSER_ASSEMBLED_LABEL, BROWSER_ASSEMBLED_NOTICE, snapshotIdentityNote } from './notices';
import { t } from '@/lib/i18n';

function describeSource(source: EvidenceSourceSummary): string {
  const name = source.agencyCode ?? t('sumber belum tersedia');
  const title = source.datasetTitle ?? source.datasetId ?? t('dataset belum tersedia');
  const years = source.years.length > 0 ? ` (${source.years.join(', ')})` : '';
  return `${name}, ${title}${years}`;
}

/**
 * A plain-text citation of the record. It cites only what the record holds, always names the mode
 * and snapshot, and repeats that the passport is browser-assembled rather than an official archive.
 */
export function buildCitation(
  record: Pick<EvidenceBase, 'title' | 'source' | 'sources'>,
  link: string,
  details: readonly string[] = [],
): string {
  const { source } = record;
  const mode = source.dataMode === 'LIVE' ? 'LIVE' : t('DEMO (data simulasi, bukan observasi resmi)');
  const sources =
    record.sources.length > 0 ? record.sources.map(describeSource).join('; ') : t('sumber belum tersedia');
  return [
    t('Nusa Matra, Paspor Bukti: {0}.', record.title),
    t(
      'Mode data: {0}. Versi data Data Hub: {1}. {2}',
      mode,
      source.snapshotId,
      snapshotIdentityNote(source.reproducibility),
    ),
    t('Sumber data: {0}.', sources),
    ...details,
    t('Diterima peramban: {0}.', formatBrowserTime(source.receivedByBrowserAt)),
    BROWSER_ASSEMBLED_LABEL(),
    BROWSER_ASSEMBLED_NOTICE(),
    t('Tautan: {0}', link),
  ].join('\n');
}
