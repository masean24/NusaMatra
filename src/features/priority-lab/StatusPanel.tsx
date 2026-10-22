import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon/Icon';
import styles from './PriorityLab.module.css';

/**
 * ok: validated · loading: (re)calculating · warning: incomplete data, shown with a caveat ·
 * blocked: integrity checks withheld the ranking · error: request failed · demo: simulated data.
 */
export type StatusTone = 'ok' | 'loading' | 'warning' | 'blocked' | 'error' | 'demo';

const ICON: Record<Exclude<StatusTone, 'loading'>, IconName> = {
  ok: 'check',
  warning: 'warning',
  blocked: 'close',
  error: 'warning',
  demo: 'test',
};

interface StatusPanelProps {
  readonly tone: StatusTone;
  readonly title: string;
  /** One short sentence. */
  readonly children?: ReactNode;
  /** Technical facts, behind "Lihat alasan dan detail teknis". */
  readonly details?: ReactNode;
  readonly detailsLabel?: string;
  /** Only when acting can help (a retry after a failed request). */
  readonly action?: ReactNode;
}

/**
 * The one place the Lab says how far the analysis is and whether it can be trusted: a heading, a
 * sentence, an icon, and the technical facts on demand. The tone is also in the text and icon, never
 * colour alone.
 */
export function StatusPanel({
  tone,
  title,
  children,
  details,
  detailsLabel = 'Lihat alasan dan detail teknis',
  action,
}: StatusPanelProps) {
  const urgent = tone === 'blocked' || tone === 'error';
  return (
    <div className={styles.status} data-tone={tone} role={urgent ? 'alert' : 'status'}>
      <span className={styles.statusIcon} aria-hidden="true">
        {tone === 'loading' ? <span className={styles.spinner} /> : <Icon name={ICON[tone]} size={20} />}
      </span>
      <div className={styles.statusBody}>
        <p className={styles.statusTitle}>{title}</p>
        {children && <p className={styles.statusText}>{children}</p>}
        {details && (
          <details className={styles.statusDetails}>
            <summary>{detailsLabel}</summary>
            <div className={styles.statusDetailsBody}>{details}</div>
          </details>
        )}
        {action && <div className={styles.statusAction}>{action}</div>}
      </div>
    </div>
  );
}
