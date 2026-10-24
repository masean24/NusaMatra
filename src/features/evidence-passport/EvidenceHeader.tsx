import type { EvidenceBase } from './evidenceTypes';
import { BROWSER_ASSEMBLED_LABEL, BROWSER_ASSEMBLED_NOTICE } from './notices';
import { ModeTag } from './Section';
import styles from './EvidencePassport.module.css';

interface EvidenceHeaderProps {
  readonly record: Pick<EvidenceBase, 'title' | 'question' | 'source' | 'linkWarnings'>;
  readonly kindLabel: string;
  readonly link: string;
}

export function EvidenceHeader({ record, kindLabel, link }: EvidenceHeaderProps) {
  const warnings = record.linkWarnings.filter((warning) => warning.severity === 'warning');
  const infos = record.linkWarnings.filter((warning) => warning.severity === 'info');

  return (
    <header className={styles.header}>
      <div className={styles.headerTags}>
        <ModeTag mode={record.source.dataMode} />
        <span className={styles.tag}>Snapshot {record.source.snapshotId}</span>
        <span className={styles.tag}>{kindLabel}</span>
      </div>
      <h2 className="kk-h2">{record.title}</h2>
      <p className={`kk-body ${styles.question}`}>
        <strong>Pertanyaan: </strong>
        {record.question}
      </p>
      <p className={`kk-small ${styles.notice}`} role="note">
        <strong>{BROWSER_ASSEMBLED_LABEL} </strong>
        {BROWSER_ASSEMBLED_NOTICE}
      </p>

      {warnings.length > 0 && (
        <div role="alert" className={styles.linkWarnings}>
          {warnings.map((warning) => (
            <p key={warning.code} className={`kk-small ${styles.linkWarning}`} data-severity="warning">
              <strong>Peringatan tautan: </strong>
              {warning.message}
            </p>
          ))}
        </div>
      )}
      {infos.length > 0 && (
        <div role="status" className={styles.linkWarnings}>
          {infos.map((info) => (
            <p key={info.code} className={`kk-small ${styles.linkWarning}`} data-severity="info">
              {info.message}
            </p>
          ))}
        </div>
      )}
      <p className={`kk-small ${styles.muted} ${styles.code}`}>Alamat halaman: {link}</p>
    </header>
  );
}
