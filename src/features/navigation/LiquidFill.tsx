import type { CSSProperties } from 'react';
import styles from './LiquidFill.module.css';

interface LiquidFillProps {
  /** `hover` = transient wash for hover/focus; `active` = the settled fill of the current route. */
  readonly kind: 'hover' | 'active';
  /** Id of the shared gooey filter rendered once by the navbar. */
  readonly filterId: string;
}

/*
 * Satellite lobes leave the origin slightly ahead of the main blob and are swallowed by it; the
 * gooey filter melts their edges together so the fill reads as one spreading liquid, not circles.
 * Offsets are in px relative to the pointer origin.
 */
const LOBES = [
  { dx: 26, dy: -10, r: 11 },
  { dx: -20, dy: 9, r: 9 },
  { dx: 44, dy: 8, r: 7 },
] as const;

/** Decorative only: hidden from assistive technology and never intercepts the pointer. */
export function LiquidFill({ kind, filterId }: LiquidFillProps) {
  return (
    <span className={`${styles.liquid} ${styles[kind]}`} aria-hidden="true">
      <svg className={styles.canvas} focusable="false">
        <g filter={`url(#${filterId})`}>
          <circle className={styles.blob} r="160" />
          {LOBES.map((lobe) => (
            <circle
              key={`${lobe.dx}:${lobe.dy}`}
              className={styles.lobe}
              r={lobe.r}
              style={{ '--lobe-x': `${lobe.dx}px`, '--lobe-y': `${lobe.dy}px` } as CSSProperties}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}
