import type { EvidenceBase } from './evidenceTypes';
import { formatBrowserTime, formatServerTime } from './formatTime';
import { COMPLETENESS_CLAIM_NOTE, MANIFEST_CHECKSUM_LABEL, SNAPSHOT_MUTABILITY_NOTE } from './notices';
import { ModeTag, Section } from './Section';
import styles from './EvidencePassport.module.css';

/**
 * Where the data came from. Mode, snapshot and times are read from the Data Hub's responses, never
 * from the page address; this replaces the app's usual data banner, which would show the app-wide
 * mode instead of the mode of this record.
 */
export function SourceStatusSection({ record }: { readonly record: Pick<EvidenceBase, 'source'> }) {
  const { source } = record;
  const { snapshot } = source;
  const completeness = snapshot?.completenessPct ?? null;

  return (
    <Section id="paspor-status-sumber" title="Status sumber data" mode={source.dataMode}>
      <dl className={styles.facts}>
        <div>
          <dt>Mode data (dari respons Data Hub)</dt>
          <dd>
            <ModeTag mode={source.dataMode} />{' '}
            {source.dataMode === 'LIVE'
              ? 'Data dari snapshot LIVE Data Hub.'
              : 'Data simulasi, bukan observasi resmi.'}
          </dd>
        </div>
        <div>
          <dt>ID snapshot (dari respons Data Hub)</dt>
          <dd className={styles.code}>{source.snapshotId}</dd>
        </div>
        <div>
          <dt>Nama snapshot</dt>
          <dd>{snapshot?.label ?? 'belum tersedia'}</dd>
        </div>
        <div>
          <dt>Dipublikasikan di Data Hub</dt>
          <dd>{formatServerTime(snapshot?.publishedAt ?? null)}</dd>
        </div>
        <div>
          <dt>Versi batas wilayah</dt>
          <dd>{snapshot?.boundaryVersion ?? 'belum tersedia'}</dd>
        </div>
        <div>
          <dt>Kelengkapan indikator snapshot (menurut server)</dt>
          <dd>
            {completeness === null
              ? 'belum tersedia'
              : `${completeness.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`}
          </dd>
        </div>
        <div>
          <dt>Indikator berdata (menurut /indicators/coverage)</dt>
          <dd>
            {source.observedCoverage
              ? `${String(source.observedCoverage.availableIndicators)} dari ${String(source.observedCoverage.totalIndicators)} indikator berdata`
              : source.dataMode === 'DEMO'
                ? 'tidak tersedia pada mode DEMO'
                : 'belum tersedia'}
          </dd>
        </div>
        <div>
          <dt>Respons diterima peramban</dt>
          <dd>{formatBrowserTime(source.receivedByBrowserAt)}</dd>
        </div>
        <div>
          <dt>Konsistensi respons</dt>
          <dd>
            {source.consistent
              ? 'Semua respons berasal dari mode dan snapshot yang sama.'
              : 'Respons berasal dari mode atau snapshot yang berbeda. Perbandingan ditahan.'}
          </dd>
        </div>
      </dl>
      <p className={`kk-small ${styles.snapshotNote}`}>{SNAPSHOT_MUTABILITY_NOTE}</p>
      {completeness !== null && source.observedCoverage !== null && (
        <p className={`kk-small ${styles.muted}`}>{COMPLETENESS_CLAIM_NOTE}</p>
      )}
      {snapshot === null && (
        <p className={`kk-small ${styles.muted}`}>
          Rincian snapshot belum tersedia: daftar snapshot tidak dapat dimuat atau tidak memuat snapshot ini.
        </p>
      )}
      <details className={styles.details}>
        <summary className="kk-small">Detail teknis</summary>
        <p className={`kk-small ${styles.muted}`}>
          {snapshot?.reportedManifestChecksum
            ? `Checksum manifest: ${MANIFEST_CHECKSUM_LABEL}.`
            : 'Checksum manifest: belum tersedia atau hanya berupa placeholder, sehingga tidak ditampilkan.'}
        </p>
        {snapshot?.reportedManifestChecksum && (
          <p className={`kk-small ${styles.code}`}>{snapshot.reportedManifestChecksum}</p>
        )}
        <p className={`kk-small ${styles.muted}`}>
          Data Hub belum menyediakan nomor laporan, tanda waktu pembuatan dari server, atau penguncian
          snapshot per permintaan.
        </p>
      </details>
    </Section>
  );
}
