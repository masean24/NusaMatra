import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon/Icon';
import styles from './StatusMessage.module.css';

/**
 * docs/03 §6.9: loading, empty, error, unavailable (and neutral info) are distinct states, each
 * with its own icon, wording and announcement, never colour alone.
 */
export type StatusKind = 'loading' | 'empty' | 'error' | 'unavailable' | 'info';

const STATUS_ICON: Record<Exclude<StatusKind, 'loading'>, IconName> = {
  empty: 'search',
  error: 'warning',
  unavailable: 'close',
  info: 'check',
};

interface StatusMessageProps {
  readonly kind: StatusKind;
  readonly title: string;
  readonly children?: ReactNode;
  /** A recovery action (retry, clear search, go back). */
  readonly action?: ReactNode;
  readonly className?: string | undefined;
}

export function StatusMessage({ kind, title, children, action, className }: StatusMessageProps) {
  // Errors interrupt (alert); everything else is announced politely.
  const role = kind === 'error' ? 'alert' : 'status';
  return (
    <div
      role={role}
      className={['glass', styles.status, className].filter(Boolean).join(' ')}
      data-kind={kind}
    >
      <span className={styles.icon} aria-hidden="true">
        {kind === 'loading' ? (
          <span className={styles.spinner} />
        ) : (
          <Icon name={STATUS_ICON[kind]} size={22} />
        )}
      </span>
      <span className={styles.text}>
        <span className="kk-body-strong">{title}</span>
        {children && <span className={`kk-small ${styles.detail}`}>{children}</span>}
        {action && <span className={styles.action}>{action}</span>}
      </span>
    </div>
  );
}
