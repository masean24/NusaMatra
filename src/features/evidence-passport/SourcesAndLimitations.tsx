import { useId, useState } from 'react';
import { Disclosure } from './Disclosure';
import type { EvidenceBase } from './evidenceTypes';
import type { LimitationNote } from './limitationNote';
import { BROWSER_ASSEMBLED_NOTICE } from './notices';
import { PassportIcon } from './PassportIcons';
import { agencyTile, formatServerStamp } from './passportFormat';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';

export function SourcesSection({ record }: { readonly record: Pick<EvidenceBase, 'sources' | 'source'> }) {
  return (
    <Section
      id="paspor-sumber"
      title="Sumber data"
      mode={record.source.dataMode}
      description="Penerbit asli tiap indikator. Buka sumber resmi untuk memeriksa angka langsung."
    >
      {record.sources.length === 0 ? (
        <p>Sumber belum tersedia: tidak ada nilai yang dapat ditelusuri ke dataset.</p>
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
                  <p className={styles.eyebrow}>{source.agencyCode ?? 'Lembaga belum tersedia'}</p>
                  <h3 className={styles.sourceTitle}>
                    {source.datasetTitle ?? source.datasetId ?? 'Judul dataset belum tersedia'}
                  </h3>
                  <ul role="list" className={styles.chipRow}>
                    <li
                      className={
                        source.years.length > 0 ? styles.softChip : `${styles.softChip} ${styles.chipWarn}`
                      }
                    >
                      {source.years.length > 0
                        ? `Tahun data ${source.years.join(', ')}`
                        : 'Tahun data belum tersedia'}
                    </li>
                    <li className={styles.softChip}>{source.indicatorCount} indikator</li>
                    <li className={styles.softChip}>Lisensi: {source.licenseName ?? 'belum tersedia'}</li>
                    <li className={styles.softChip}>
                      Pembaruan: {source.updateFrequency ?? 'belum tersedia'}
                    </li>
                    <li className={styles.softChip}>Akses: {source.accessMethod ?? 'belum tersedia'}</li>
                  </ul>
                  <p className={styles.sourceMeta}>
                    Dimuat ke Data Hub {ingested.text}
                    {ingested.zone ? ` ${ingested.zone}` : ' (zona waktu tidak dinyatakan server)'}. Waktu
                    ambil dari penerbit belum tersedia.
                  </p>
                  {source.officialUrl ? (
                    <a
                      className={styles.sourceLink}
                      href={source.officialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Buka sumber resmi
                      <PassportIcon name="external" size={13} />
                      <span className={styles.srOnly}> (membuka tab baru)</span>
                    </a>
                  ) : (
                    <p className={styles.sourceMeta}>Tautan sumber belum tersedia.</p>
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
        <span className={styles.softChip}>{note.category}</span>
        <h3 className={styles.limitTitle}>{note.title}</h3>
        <p className={styles.limitText}>{note.text}</p>
      </div>
    </li>
  );

  return (
    <Section
      id="batasan"
      title="Batasan dan catatan"
      mode={record.source.dataMode}
      badge={`${String(notes.length)} batasan`}
      description="Baca sebelum mengutip. Tiap batasan diberi label apa yang terdampak: data, metode, cakupan, atau reproduksibilitas."
    >
      <Disclosure
        title="Apa arti Paspor Bukti ini?"
        helper="Cara paspor dirangkai dan apa yang tidak dijaminnya"
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
            {expanded ? 'Sembunyikan batasan lainnya' : `Tampilkan ${String(rest.length)} batasan lainnya`}
            <PassportIcon name="chevronDown" size={14} />
          </button>
        </>
      )}
    </Section>
  );
}
