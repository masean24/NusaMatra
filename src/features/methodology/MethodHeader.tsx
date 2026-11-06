import { BackButton } from '@/features/navigation';
import styles from './Methodology.module.css';
import { t } from '@/lib/i18n';

/** The page heading: the way back, the "Metodologi" kicker, the title and its summary. */
export function MethodHeader({ title, summary }: { readonly title: string; readonly summary: string }) {
  return (
    <header className={styles.header}>
      <BackButton />
      <p className={styles.kicker}>{t('Metodologi')}</p>
      <h1 className="kk-h1">{title}</h1>
      <p className={`kk-lead ${styles.headerSummary}`}>{summary}</p>
    </header>
  );
}
