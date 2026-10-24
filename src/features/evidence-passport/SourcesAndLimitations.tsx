import type { EvidenceBase } from './evidenceTypes';
import { formatServerTime } from './formatTime';
import { Section } from './Section';
import styles from './EvidencePassport.module.css';

export function SourcesSection({ record }: { readonly record: Pick<EvidenceBase, 'sources' | 'source'> }) {
  return (
    <Section id="paspor-sumber" title="Sumber data" mode={record.source.dataMode}>
      {record.sources.length === 0 ? (
        <p className="kk-body">Sumber belum tersedia: tidak ada nilai yang dapat ditelusuri ke dataset.</p>
      ) : (
        <ul role="list" className={styles.list}>
          {record.sources.map((source) => (
            <li key={source.datasetId ?? source.agencyCode ?? 'tanpa-dataset'}>
              <p className="kk-body-strong">
                {source.agencyCode ?? 'Lembaga belum tersedia'} ·{' '}
                {source.datasetTitle ?? source.datasetId ?? 'judul dataset belum tersedia'}
              </p>
              <p className={`kk-small ${styles.muted}`}>
                Tahun data: {source.years.length > 0 ? source.years.join(', ') : 'belum tersedia'} ·{' '}
                {source.indicatorCount} indikator · Lisensi: {source.licenseName ?? 'belum tersedia'} ·
                Pembaruan: {source.updateFrequency ?? 'belum tersedia'} · Cara akses:{' '}
                {source.accessMethod ?? 'belum tersedia'}
              </p>
              <p className={`kk-small ${styles.muted}`}>
                Dimuat ke Data Hub: {formatServerTime(source.lastIngestedAt)}. Waktu pengambilan dari penerbit
                data: belum tersedia.
              </p>
              <p className="kk-small">
                {source.officialUrl ? (
                  <a
                    className={styles.link}
                    href={source.officialUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Buka sumber resmi
                    <span className={styles.srOnly}> (membuka tab baru)</span>
                  </a>
                ) : (
                  'Tautan sumber belum tersedia.'
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function LimitationsSection({
  record,
}: {
  readonly record: Pick<EvidenceBase, 'limitations' | 'source'>;
}) {
  return (
    <Section id="paspor-batasan" title="Batasan dan catatan" mode={record.source.dataMode}>
      <ul role="list" className={`kk-body ${styles.list}`}>
        {record.limitations.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </Section>
  );
}
