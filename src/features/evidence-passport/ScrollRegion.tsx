import type { ReactNode } from 'react';
import styles from './EvidencePassport.module.css';

/**
 * A table that is wider than a phone scrolls inside its own box, never the page. The box is a
 * labelled region and is reachable by keyboard, so the columns that do not fit can still be read.
 * In print the box does not clip (see the stylesheet).
 */
export function ScrollRegion({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    // A scrollable region must take focus so keyboard users can scroll it; it is named by `label`.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className={styles.tableScroll} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
