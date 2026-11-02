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
  /**
   * The loading mark: a turning ring (default), or three stacked map layers lifting in turn, for
   * waits about map layers (the boundary check over the Jelajahi map).
   */
  readonly loadingIcon?: LoadingIcon | undefined;
}

export type LoadingIcon = 'spinner' | 'layers';

/** Three stacked layers (top, middle, base) that float up one after another. */
function LayersMark() {
  return (
    <svg
      className={styles.layers}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 3 3 8 12 13 21 8 12 3" className={styles.layerTop} />
      <polyline points="3 13 12 18 21 13" className={styles.layerMiddle} />
      <polyline points="3 17.5 12 22.5 21 17.5" className={styles.layerBase} />
    </svg>
  );
}

export function StatusMessage({
  kind,
  title,
  children,
  action,
  className,
  loadingIcon = 'spinner',
}: StatusMessageProps) {
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
          loadingIcon === 'layers' ? (
            <LayersMark />
          ) : (
            <span className={styles.spinner} />
          )
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
