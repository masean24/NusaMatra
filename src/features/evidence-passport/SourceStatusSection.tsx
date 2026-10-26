import type { ReactNode } from 'react';
import { Disclosure } from './Disclosure';
import type { EvidenceBase } from './evidenceTypes';
import { COMPLETENESS_CLAIM_NOTE, MANIFEST_CHECKSUM_LABEL, snapshotIdentityNote } from './notices';
import { PassportIcon, type PassportIconName } from './PassportIcons';
import { formatReceived, formatServerStamp, shortDigest } from './passportFormat';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';

const formatPercent = (value: number) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

function Column({
  icon,
  title,
  children,
}: {
  readonly icon: PassportIconName;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.statusColumn}>
      <h3 className={styles.statusColumnTitle}>
        <PassportIcon name={icon} />
        {title}
      </h3>
      <dl className={styles.statusFacts}>{children}</dl>
    </div>
  );
}

function Fact({
  label,
  children,
  hint,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly hint?: string | undefined;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {children}
        {hint && <span className={styles.factHint}>{hint}</span>}
      </dd>
    </div>
  );
}

interface SourceStatusSectionProps {
  readonly record: Pick<EvidenceBase, 'source' | 'linkWarnings'>;
  /** The agencies the record's values come from. */
  readonly agencies: readonly string[];
  /** The page address naming the pinned snapshot, kept in "Detail teknis". */
  readonly link: string;
  readonly onCopyDigest: (digest: string) => void;
}

/**
 * Where the data came from. Mode, snapshot and times are read from the Data Hub's responses, never
 * from the page address; this replaces the app's usual data banner, which would show the app-wide
 * mode instead of the mode of this record.
 */
export function SourceStatusSection({ record, agencies, link, onCopyDigest }: SourceStatusSectionProps) {
  const { source } = record;
  const { snapshot, reproducibility } = source;
  const completeness = snapshot?.completenessPct ?? null;
  const digest = snapshot?.contentSha256 ?? null;
  const published = formatServerStamp(snapshot?.publishedAt ?? null);
  const infos = record.linkWarnings.filter((warning) => warning.severity === 'info');

  return (
    <Section
      id="paspor-status-sumber"
      title="Status sumber data"
      mode={source.dataMode}
      meta={`Respons diterima ${formatReceived(source.receivedByBrowserAt, true)}`}
    >
      <div className={styles.statusGrid}>
        <Column icon="layers" title="Snapshot">
          <Fact label="Nama">{snapshot?.label ?? 'belum tersedia'}</Fact>
          <Fact label="Penyedia data">
            {agencies.length > 0 ? (
              <span className={styles.chipRow}>
                {agencies.map((agency) => (
                  <span key={agency} className={styles.softChip}>
                    {agency}
                  </span>
                ))}
              </span>
            ) : (
              'belum tersedia'
            )}
          </Fact>
          <Fact
            label="Dipublikasikan"
            hint={
              published.zone === null ? 'Zona waktu tidak dinyatakan server' : `Zona waktu ${published.zone}`
            }
          >
            {published.text}
          </Fact>
        </Column>

        <Column icon="globe" title="Cakupan">
          <Fact label="Versi batas wilayah">{snapshot?.boundaryVersion ?? 'belum tersedia'}</Fact>
          <Fact label="Indikator berdata">
            {source.observedCoverage
              ? `${String(source.observedCoverage.availableIndicators)} dari ${String(source.observedCoverage.totalIndicators)}`
              : source.dataMode === 'DEMO'
                ? 'tidak tersedia pada mode DEMO'
                : 'belum tersedia'}
          </Fact>
          <Fact label="Kelengkapan snapshot">
            {completeness === null ? 'belum tersedia' : formatPercent(completeness)}
          </Fact>
        </Column>

        <Column icon="shield" title="Integritas">
          <Fact label="Mode data">
            {source.dataMode === 'LIVE'
              ? 'LIVE · snapshot Data Hub'
              : 'DEMO · data simulasi, bukan observasi resmi'}
          </Fact>
          <Fact label="ID snapshot">
            <span className={styles.monoBox}>{source.snapshotId}</span>
          </Fact>
          <Fact label="Sidik SHA-256">
            {digest ? (
              <span className={styles.digestRow}>
                <span className={styles.monoBox}>
                  <span aria-hidden="true">{shortDigest(digest)}</span>
                  <span className={styles.srOnly}>{digest}</span>
                </span>
                <button
                  type="button"
                  className={styles.inlineButton}
                  aria-label="Salin sidik isi data"
                  onClick={() => {
                    onCopyDigest(digest);
                  }}
                >
                  <PassportIcon name="copy" size={14} />
                  Salin
                </button>
              </span>
            ) : (
              'tidak ada (snapshot tanpa sidik isi data)'
            )}
          </Fact>
          <Fact label="Reproduksibilitas">
            {reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
              ? reproducibility.origin === 'LINK'
                ? 'Dapat direproduksi: dikunci ke snapshot pada tautan.'
                : 'Dapat direproduksi: dikunci ke snapshot aktif saat dibuka.'
              : 'Tidak dapat direproduksi.'}
          </Fact>
        </Column>
      </div>

      {infos.length > 0 && (
        <Disclosure
          title="Catatan tentang tautan ini"
          helper="Snapshot mana yang dipakai saat halaman dibuka"
        >
          {infos.map((info) => (
            <p key={info.code} data-severity="info">
              {info.message}
            </p>
          ))}
        </Disclosure>
      )}
      {snapshot === null && (
        <p className={styles.muted}>
          Rincian snapshot belum tersedia: daftar snapshot tidak dapat dimuat atau tidak memuat snapshot ini.
        </p>
      )}

      <Disclosure
        title="Arti reproduksibilitas snapshot"
        helper={
          reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
            ? 'Yang dijamin sidik isi data, dan yang tidak'
            : 'Mengapa data ini tidak dikunci ke snapshot'
        }
      >
        <p className={styles.snapshotNote}>{snapshotIdentityNote(reproducibility)}</p>
        {completeness !== null && source.observedCoverage !== null && (
          <p className={styles.muted}>{COMPLETENESS_CLAIM_NOTE}</p>
        )}
      </Disclosure>
      <Disclosure
        title="Detail teknis"
        helper="Checksum manifest, spesifikasi sidik isi data, jumlah observasi"
      >
        <p className={styles.muted}>
          {snapshot?.reportedManifestChecksum
            ? `Checksum manifest: ${MANIFEST_CHECKSUM_LABEL}.`
            : 'Checksum manifest: belum tersedia atau hanya berupa placeholder, sehingga tidak ditampilkan.'}
        </p>
        {snapshot?.reportedManifestChecksum && (
          <p className={styles.code}>{snapshot.reportedManifestChecksum}</p>
        )}
        {digest && (
          <>
            <p className={styles.code}>SHA-256: {digest}</p>
            <p className={styles.muted}>
              Sidik isi data dihitung Data Hub dengan spesifikasi{' '}
              {snapshot?.contentHashSpec ?? 'yang tidak disebut'}
              {snapshot?.methodologyVersion ? `, metodologi ${snapshot.methodologyVersion}` : ''}; peramban
              tidak menghitungnya ulang.
              {snapshot?.observationCount != null &&
                ` Snapshot memuat ${snapshot.observationCount.toLocaleString('id-ID')} observasi, ${String(snapshot.availableIndicatorCount ?? '?')} dari ${String(snapshot.indicatorCount ?? '?')} indikator berdata, ${String(snapshot.regionCount ?? '?')} wilayah, dan ${String(snapshot.datasetCount ?? '?')} dataset (menurut Data Hub).`}
            </p>
          </>
        )}
        <p className={styles.muted}>
          Indikator berdata dibaca dari /indicators/coverage; kelengkapan snapshot dinyatakan server Data Hub.
        </p>
        {source.observedCoverage?.regionCoveragePct != null && (
          <p className={styles.muted}>
            Wilayah yang punya observasi (bukan jumlah indikator):{' '}
            {formatPercent(source.observedCoverage.regionCoveragePct)}.
          </p>
        )}
        <p className={styles.muted}>
          Data Hub tidak menyediakan nomor laporan atau tanda waktu pembuatan laporan dari server; Paspor ini
          tidak diarsipkan di mana pun.
        </p>
        <p className={styles.muted}>Alamat halaman ini (menyebut snapshot di atas):</p>
        <p className={styles.code}>{link}</p>
      </Disclosure>
    </Section>
  );
}
