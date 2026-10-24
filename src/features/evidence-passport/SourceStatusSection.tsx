import type { EvidenceBase } from './evidenceTypes';
import { formatBrowserTime, formatServerTime } from './formatTime';
import { COMPLETENESS_CLAIM_NOTE, MANIFEST_CHECKSUM_LABEL, snapshotIdentityNote } from './notices';
import { ModeTag, Section } from './Section';
import styles from './EvidencePassport.module.css';

const formatPercent = (value: number) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

/**
 * Where the data came from. Mode, snapshot and times are read from the Data Hub's responses, never
 * from the page address; this replaces the app's usual data banner, which would show the app-wide
 * mode instead of the mode of this record.
 */
export function SourceStatusSection({ record }: { readonly record: Pick<EvidenceBase, 'source'> }) {
  const { source } = record;
  const { snapshot, reproducibility } = source;
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
          <dt>Reproduksibilitas data</dt>
          <dd>
            {reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
              ? reproducibility.origin === 'LINK'
                ? 'Dapat direproduksi: dikunci ke snapshot pada tautan.'
                : 'Dapat direproduksi: dikunci ke snapshot aktif saat dibuka.'
              : 'Tidak dapat direproduksi.'}
          </dd>
        </div>
        <div>
          <dt>Sidik isi data SHA-256 (menurut Data Hub)</dt>
          <dd className={snapshot?.contentSha256 ? styles.code : undefined}>
            {snapshot?.contentSha256 ?? 'tidak ada (snapshot tanpa sidik isi data)'}
          </dd>
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
          <dd>{completeness === null ? 'belum tersedia' : formatPercent(completeness)}</dd>
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
        {source.observedCoverage?.regionCoveragePct != null && (
          <div>
            <dt>Wilayah yang punya observasi (bukan jumlah indikator)</dt>
            <dd>{formatPercent(source.observedCoverage.regionCoveragePct)}</dd>
          </div>
        )}
        <div>
          <dt>Respons diterima peramban</dt>
          <dd>{formatBrowserTime(source.receivedByBrowserAt)}</dd>
        </div>
        <div>
          <dt>Konsistensi respons</dt>
          <dd>
            {source.consistent
              ? 'Semua respons berasal dari mode, snapshot, dan sidik isi data yang sama.'
              : 'Respons berasal dari mode, snapshot, atau sidik isi data yang berbeda. Perbandingan ditahan.'}
          </dd>
        </div>
      </dl>
      <p className={`kk-small ${styles.snapshotNote}`}>{snapshotIdentityNote(reproducibility)}</p>
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
        {snapshot?.contentSha256 && (
          <p className={`kk-small ${styles.muted}`}>
            Sidik isi data dihitung Data Hub dengan spesifikasi{' '}
            {snapshot.contentHashSpec ?? 'yang tidak disebut'}
            {snapshot.methodologyVersion ? `, metodologi ${snapshot.methodologyVersion}` : ''}; peramban tidak
            menghitungnya ulang.
            {snapshot.observationCount !== null &&
              ` Snapshot memuat ${snapshot.observationCount.toLocaleString('id-ID')} observasi, ${String(snapshot.availableIndicatorCount ?? '?')} dari ${String(snapshot.indicatorCount ?? '?')} indikator berdata, ${String(snapshot.regionCount ?? '?')} wilayah, dan ${String(snapshot.datasetCount ?? '?')} dataset (menurut Data Hub).`}
          </p>
        )}
        <p className={`kk-small ${styles.muted}`}>
          Data Hub tidak menyediakan nomor laporan atau tanda waktu pembuatan laporan dari server; Paspor ini
          tidak diarsipkan di mana pun.
        </p>
      </details>
    </Section>
  );
}
