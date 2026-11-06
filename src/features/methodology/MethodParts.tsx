import type { ReactNode } from 'react';
import { StatusMessage } from '@/components/feedback/StatusMessage';
import { MethodIcon, type MethodIconName } from './MethodIcon';
import type { Loadable } from './useScoreMethod';
import styles from './Methodology.module.css';
import { t } from '@/lib/i18n';

/** A section's kicker ("LANGKAH 1"), heading and optional lead. */
export function SectionHead({
  id,
  kicker,
  title,
  children,
}: {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly children?: ReactNode;
}) {
  return (
    <header className={styles.sectionHead}>
      <p className={styles.kicker}>{kicker}</p>
      <h2 id={id} className="kk-h2">
        {title}
      </h2>
      {children && <p className={`kk-body ${styles.lead}`}>{children}</p>}
    </header>
  );
}

/** A short rule with its icon: a title and one or two sentences. */
export function IconCard({
  icon,
  title,
  children,
}: {
  readonly icon: MethodIconName;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <li className={`glass glass--read ${styles.iconCard}`}>
      <span className={styles.iconTile}>
        <MethodIcon name={icon} />
      </span>
      <h3 className="kk-body-strong">{title}</h3>
      <p className={`kk-small ${styles.muted}`}>{children}</p>
    </li>
  );
}

/** A note set apart with the info icon. */
export function InfoNote({ children }: { readonly children: ReactNode }) {
  return (
    <p className={`kk-small ${styles.infoNote}`}>
      <MethodIcon name="info" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Renders a part that waits on the Data Hub: a quiet line while loading, an error with "Coba lagi",
 * and the content once it has arrived.
 */
export function LoadableView<T>({
  part,
  loadingText,
  children,
}: {
  readonly part: Loadable<T>;
  readonly loadingText: string;
  readonly children: (value: T) => ReactNode;
}) {
  if (part.status === 'ready') return children(part.value);
  if (part.status === 'loading') {
    return (
      <p className={`kk-small ${styles.muted}`} aria-busy="true">
        {loadingText}
      </p>
    );
  }
  return (
    <StatusMessage
      kind="error"
      title={t('Data contoh tidak dapat dimuat dari Data Hub')}
      action={
        <button type="button" className="glass-btn" onClick={part.retry}>
          {t('Coba lagi')}
        </button>
      }
    >
      {t('Penjelasan rumus tetap berlaku; angka contohnya akan muncul setelah Data Hub dapat dihubungi.')}
    </StatusMessage>
  );
}
