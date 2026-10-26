import type { EvidenceBase, EvidenceSourceSummary } from './evidenceTypes';
import { formatBrowserTime } from './formatTime';
import { BROWSER_ASSEMBLED_LABEL, BROWSER_ASSEMBLED_NOTICE, snapshotIdentityNote } from './notices';

function describeSource(source: EvidenceSourceSummary): string {
  const name = source.agencyCode ?? 'sumber belum tersedia';
  const title = source.datasetTitle ?? source.datasetId ?? 'dataset belum tersedia';
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
  const mode = source.dataMode === 'LIVE' ? 'LIVE' : 'DEMO (data simulasi, bukan observasi resmi)';
  const sources =
    record.sources.length > 0 ? record.sources.map(describeSource).join('; ') : 'sumber belum tersedia';
  return [
    `Nusa Matra, Paspor Bukti: ${record.title}.`,
    `Mode data: ${mode}. Snapshot Data Hub: ${source.snapshotId}. ${snapshotIdentityNote(source.reproducibility)}`,
    `Sumber data: ${sources}.`,
    ...details,
    `Diterima peramban: ${formatBrowserTime(source.receivedByBrowserAt)}.`,
    BROWSER_ASSEMBLED_LABEL,
    BROWSER_ASSEMBLED_NOTICE,
    `Tautan: ${link}`,
  ].join('\n');
}
