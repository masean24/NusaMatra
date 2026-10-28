import type { ReactNode } from 'react';
import { Disclosure } from './Disclosure';
import type { EvidenceBase } from './evidenceTypes';

import { PassportIcon, type PassportIconName } from './PassportIcons';
import { COMPLETENESS_CLAIM_NOTE } from './notices';
import { formatReceived, formatServerStamp } from './passportFormat';
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
}

/**
 * Where the data came from, in plain terms: the data version's name and publication, the providers,
 * the coverage and whether the result can be reproduced. Identifiers and digests (snapshot id,
 * SHA-256, manifest checksum) are not shown (owner decision 2026-10-27); they stay in the JSON
 * download and in the page address. Everything is read from the Data Hub's responses, never from
 * the page address.
 */
export function SourceStatusSection({ record, agencies }: SourceStatusSectionProps) {
  const { source } = record;
  const { snapshot, reproducibility } = source;
  const completeness = snapshot?.completenessPct ?? null;
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
        <Column icon="layers" title="Versi data">
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
          <Fact label="Kelengkapan data">
            {completeness === null ? 'belum tersedia' : formatPercent(completeness)}
          </Fact>
        </Column>

        <Column icon="shield" title="Integritas">
          <Fact label="Asal data">Data resmi dari Data Hub</Fact>
          <Fact label="Reproduksibilitas">
            {reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
              ? 'Dapat direproduksi: tautan ini selalu membuka versi data yang sama.'
              : 'Tidak dapat direproduksi.'}
          </Fact>
        </Column>
      </div>

      {infos.length > 0 && (
        <Disclosure
          title="Catatan tentang tautan ini"
          helper="Versi data mana yang dipakai saat halaman dibuka"
        >
          {infos.map((info) => (
            <p key={info.code} data-severity="info">
              {info.message}
            </p>
          ))}
        </Disclosure>
      )}
      {/* The two coverage figures come from different responses and can disagree: say so, plainly. */}
      {completeness !== null && source.observedCoverage !== null && (
        <p className={styles.muted}>{COMPLETENESS_CLAIM_NOTE}</p>
      )}
      {snapshot === null && <p className={styles.muted}>Rincian versi data belum tersedia dari Data Hub.</p>}
    </Section>
  );
}
