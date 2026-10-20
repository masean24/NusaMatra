import { useRevealOnce } from '@/features/motion';
import styles from './EvidencePassport3D.module.css';

/* G8: entering at 30% visibility, the document turns from 20° to 8° and the orange seal stamps in. */
const G8_THRESHOLD = 0.3;

/**
 * 3D-4 "Paspor Bukti melayang". A flat document only needs a perspective transform, so this is
 * CSS 3D rather than a WebGL canvas: the same depth and turn at a fraction of the cost.
 */
export function EvidencePassport3D() {
  const { ref, revealed } = useRevealOnce<HTMLDivElement>(G8_THRESHOLD);

  return (
    <div ref={ref} className={styles.stage} data-revealed={revealed} aria-hidden="true">
      <div className={styles.document}>
        <span className={styles.header} />
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={`${styles.line} ${styles.short}`} />
        <span className={styles.line} />
        <span className={`${styles.line} ${styles.short}`} />
        <span className={styles.seal}>
          <svg viewBox="0 0 48 48" width="48" height="48" focusable="false">
            <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" />
            <path
              d="M15 24.5l6 6 12-13"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
