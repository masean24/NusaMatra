import type { CompositeEvidenceRecord } from './compositeTypes';
import type { EvidenceRecord } from './evidenceTypes';
import {
  BROWSER_ASSEMBLED_LABEL,
  BROWSER_ASSEMBLED_NOTICE,
  COMPLETENESS_CLAIM_NOTE,
  MANIFEST_CHECKSUM_LABEL,
  NOT_PINNED_STATEMENT,
  SNAPSHOT_MUTABILITY_NOTE,
} from './notices';

/** Name of the file format, so a reader (or a later importer) can tell what they hold. */
export const EXPORT_SCHEMA = 'nusa-matra.paspor-bukti/browser-assembled-v0';

export const EXPORT_FILENAME_PREFIX = 'nusa-matra-paspor-bukti-';

export interface ExportPayload {
  readonly schema: typeof EXPORT_SCHEMA;
  readonly notice: string;
  /** What the fields below are and are not, so the file cannot be read as proof it does not give. */
  readonly fieldNotes: {
    readonly snapshotId: string;
    readonly 'source.snapshot.reportedManifestChecksum': string;
    readonly 'source.snapshot.completenessPct': string;
    readonly fetched: string;
  };
  readonly reproducibility: { readonly pinnedInputs: false; readonly statement: string };
  /** The page address the record was opened from; context only. */
  readonly link: string;
  readonly record: EvidenceRecord | CompositeEvidenceRecord;
}

/** Everything in the file is the record as shown; nothing is added that the page does not show. */
export function buildExportPayload(
  record: EvidenceRecord | CompositeEvidenceRecord,
  link: string,
): ExportPayload {
  return {
    schema: EXPORT_SCHEMA,
    notice: `${BROWSER_ASSEMBLED_LABEL} ${BROWSER_ASSEMBLED_NOTICE}`,
    fieldNotes: {
      snapshotId: SNAPSHOT_MUTABILITY_NOTE,
      'source.snapshot.reportedManifestChecksum': MANIFEST_CHECKSUM_LABEL,
      'source.snapshot.completenessPct': `Menurut server. ${COMPLETENESS_CLAIM_NOTE}`,
      fetched:
        'Permintaan yang dikirim peramban (tanpa host atau kredensial) dan respons yang diterima; waktu terima memakai jam peramban. Tidak ada ID laporan, hash isi, atau tanda waktu server yang ditambahkan.',
    },
    reproducibility: { pinnedInputs: false, statement: NOT_PINNED_STATEMENT },
    link,
    record,
  };
}

export function serializeExport(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** `nusa-matra-paspor-bukti-bandingkan-live-3201-3174.json` */
export function exportFilename(record: EvidenceRecord | CompositeEvidenceRecord): string {
  const scope =
    record.kind === 'lab'
      ? [record.scope.provinceId ? `prov-${record.scope.provinceId}` : 'nasional']
      : record.regions.map((region) => region.regionId);
  const parts = [record.kind, record.source.dataMode.toLowerCase(), ...scope];
  const safe = parts.join('-').replace(/[^A-Za-z0-9._-]/g, '-');
  return `${EXPORT_FILENAME_PREFIX}${safe}.json`;
}
