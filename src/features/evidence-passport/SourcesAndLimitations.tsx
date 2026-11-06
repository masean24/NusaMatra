import { useId, useState } from 'react';
import { Disclosure } from './Disclosure';
import type { EvidenceBase } from './evidenceTypes';
import type { LimitationNote } from './limitationNote';
import { BROWSER_ASSEMBLED_NOTICE } from './notices';
import { PassportIcon } from './PassportIcons';
import { agencyTile, formatServerStamp } from './passportFormat';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';
import { t } from '@/lib/i18n';

export function SourcesSection({ record }: { readonly record: Pick<EvidenceBase, 'sources' | 'source'> }) {
  return (
    <Section
      id="paspor-sumber"
      title={t('Sumber data')}
      mode={record.source.dataMode}
      description={t('Penerbit asli tiap indikator. Buka sumber resmi untuk memeriksa angka langsung.')}
    >
      {record.sources.length === 0 ? (
        <p>{t('Sumber belum tersedia: tidak ada nilai yang dapat ditelusuri ke dataset.')}</p>
      ) : (
        <ul role="list" className={styles.sourceList}>
          {record.sources.map((source) => {
            const ingested = formatServerStamp(source.lastIngestedAt);
            return (
              <li
                key={source.datasetId ?? source.agencyCode ?? 'tanpa-dataset'}
                className={styles.sourceItem}
              >
                <span className={styles.agencyTile} aria-hidden="true">
                  {agencyTile(source.agencyCode)}
                </span>
                <div className={styles.sourceBody}>
                  <p className={styles.eyebrow}>{source.agencyCode ?? t('Lembaga belum tersedia')}</p>
                  <h3 className={styles.sourceTitle}>
                    {source.datasetTitle ?? source.datasetId ?? t('Judul dataset belum tersedia')}
                  </h3>
                  <ul role="list" className={styles.chipRow}>
                    <li
                      className={
                        source.years.length > 0 ? styles.softChip : `${styles.softChip} ${styles.chipWarn}`
                      }
                    >
                      {source.years.length > 0
                        ? t('Tahun data {0}', source.years.join(', '))
                        : t('Tahun data belum tersedia')}
                    </li>
                    <li className={styles.softChip}>{t('{0} indikator', source.indicatorCount)}</li>
                    <li className={styles.softChip}>
                      {t('Lisensi: {0}', source.licenseName ?? t('belum tersedia'))}
                    </li>
                    <li className={styles.softChip}>
                      {t('Pembaruan: {0}', source.updateFrequency ?? t('belum tersedia'))}
                    </li>
                    <li className={styles.softChip}>
                      {t('Akses: {0}', source.accessMethod ?? t('belum tersedia'))}
                    </li>
                  </ul>
                  <p className={styles.sourceMeta}>
                    {t(
                      'Dimuat ke Data Hub {0}{1}. Waktu ambil dari penerbit belum tersedia.',
                      ingested.text,
                      ingested.zone ? ` ${ingested.zone}` : t(' (zona waktu tidak dinyatakan server)'),
                    )}
                  </p>
                  {source.officialUrl ? (
                    <a
                      className={styles.sourceLink}
                      href={source.officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {t('Buka sumber resmi')}
                      <PassportIcon name="external" size={13} />
                      <span className={styles.srOnly}> {t('(membuka tab baru)')}</span>
                    </a>
                  ) : (
                    <p className={styles.sourceMeta}>{t('Tautan sumber belum tersedia.')}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** Limitations open on screen before the rest are shown; every one is in the record, the JSON and print. */
export const LIMITATIONS_SHOWN_FIRST = 3;

/**
 * Each limitation under a number, a category, a short title and its full text. The first three are
 * listed, the rest open with one button. Paper prints every one.
 */
export function LimitationsSection({
  record,
  notes,
}: {
  readonly record: Pick<EvidenceBase, 'source'>;
  readonly notes: readonly LimitationNote[];
}) {
  const [expanded, setExpanded] = useState(false);
  const restId = useId();
  const first = notes.slice(0, LIMITATIONS_SHOWN_FIRST);
  const rest = notes.slice(LIMITATIONS_SHOWN_FIRST);
  const item = (note: LimitationNote, index: number) => (
    <li key={note.text} className={styles.limitItem}>
      <span className={styles.limitNumber} aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className={styles.limitBody}>
        <span className={styles.softChip}>{t(note.category)}</span>
        <h3 className={styles.limitTitle}>{note.title}</h3>
        <p className={styles.limitText}>{note.text}</p>
      </div>
    </li>
  );

  return (
    <Section
      id="batasan"
      title={t('Batasan dan catatan')}
      mode={record.source.dataMode}
      badge={`${String(notes.length)} batasan`}
      description={t(
        'Baca sebelum mengutip. Tiap batasan diberi label apa yang terdampak: data, metode, cakupan, atau reproduksibilitas.',
      )}
    >
      <Disclosure
        title={t('Apa arti Paspor Bukti ini?')}
        helper={t('Cara paspor dirangkai dan apa yang tidak dijaminnya')}
      >
        <p>{BROWSER_ASSEMBLED_NOTICE}</p>
      </Disclosure>
      <ol role="list" className={styles.limitList}>
        {first.map(item)}
      </ol>
      {rest.length > 0 && (
        <>
          <ol
            role="list"
            id={restId}
            className={styles.limitList}
            hidden={!expanded}
            start={first.length + 1}
          >
            {rest.map((note, index) => item(note, index + first.length))}
          </ol>
          <button
            type="button"
            className={styles.moreButton}
            aria-expanded={expanded}
            aria-controls={restId}
            onClick={() => {
              setExpanded((current) => !current);
            }}
          >
            {expanded
              ? t('Sembunyikan batasan lainnya')
              : t('Tampilkan {0} batasan lainnya', String(rest.length))}
            <PassportIcon name="chevronDown" size={14} />
          </button>
        </>
      )}
    </Section>
  );
}
