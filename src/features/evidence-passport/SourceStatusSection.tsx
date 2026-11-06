import type { ReactNode } from 'react';
import { Disclosure } from './Disclosure';
import type { EvidenceBase } from './evidenceTypes';

import { PassportIcon, type PassportIconName } from './PassportIcons';
import { COMPLETENESS_CLAIM_NOTE } from './notices';
import { formatReceived, formatServerStamp } from './passportFormat';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';
import { locale, t } from '@/lib/i18n';

const formatPercent = (value: number) => `${value.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;

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
      title={t('Status sumber data')}
      mode={source.dataMode}
      meta={t('Respons diterima {0}', formatReceived(source.receivedByBrowserAt, true))}
    >
      <div className={styles.statusGrid}>
        <Column icon="layers" title={t('Versi data')}>
          <Fact label={t('Nama')}>{snapshot?.label ?? t('belum tersedia')}</Fact>
          <Fact label={t('Penyedia data')}>
            {agencies.length > 0 ? (
              <span className={styles.chipRow}>
                {agencies.map((agency) => (
                  <span key={agency} className={styles.softChip}>
                    {agency}
                  </span>
                ))}
              </span>
            ) : (
              t('belum tersedia')
            )}
          </Fact>
          <Fact
            label={t('Dipublikasikan')}
            hint={
              published.zone === null
                ? t('Zona waktu tidak dinyatakan server')
                : t('Zona waktu {0}', published.zone)
            }
          >
            {published.text}
          </Fact>
        </Column>

        <Column icon="globe" title={t('Cakupan')}>
          <Fact label={t('Versi batas wilayah')}>{snapshot?.boundaryVersion ?? t('belum tersedia')}</Fact>
          <Fact label={t('Indikator berdata')}>
            {source.observedCoverage
              ? t(
                  '{0} dari {1}',
                  String(source.observedCoverage.availableIndicators),
                  String(source.observedCoverage.totalIndicators),
                )
              : source.dataMode === 'DEMO'
                ? t('tidak tersedia pada mode DEMO')
                : t('belum tersedia')}
          </Fact>
          <Fact label={t('Kelengkapan data')}>
            {completeness === null ? t('belum tersedia') : formatPercent(completeness)}
          </Fact>
        </Column>

        <Column icon="shield" title={t('Integritas')}>
          <Fact label={t('Asal data')}>{t('Data resmi dari Data Hub')}</Fact>
          <Fact label={t('Reproduksibilitas')}>
            {reproducibility.status === 'REPRODUCIBLE_SNAPSHOT'
              ? t('Dapat direproduksi: tautan ini selalu membuka versi data yang sama.')
              : t('Tidak dapat direproduksi.')}
          </Fact>
        </Column>
      </div>

      {infos.length > 0 && (
        <Disclosure
          title={t('Catatan tentang tautan ini')}
          helper={t('Versi data mana yang dipakai saat halaman dibuka')}
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
        <p className={styles.muted}>{COMPLETENESS_CLAIM_NOTE()}</p>
      )}
      {snapshot === null && (
        <p className={styles.muted}>{t('Rincian versi data belum tersedia dari Data Hub.')}</p>
      )}
    </Section>
  );
}
