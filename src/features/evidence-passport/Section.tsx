import type { ReactNode } from 'react';
import { Surface } from '@/components/ui/Surface/Surface';
import type { DataMode } from '@/services/api';
import styles from './EvidencePassport.module.css';

/** LIVE or DEMO as words in a bordered tag: it must read on screen, in print, and without colour. */
export function ModeTag({ mode }: { readonly mode: DataMode }) {
  return mode === 'LIVE' ? (
    <span className={styles.tag}>LIVE</span>
  ) : (
    <span className={`${styles.tag} ${styles.tagWarn}`}>DEMO · data simulasi</span>
  );
}

interface SectionProps {
  readonly id: string;
  readonly title: string;
  /** The mode the record was actually received in; repeated in every section. */
  readonly mode: DataMode;
  readonly children: ReactNode;
}

export function Section({ id, title, mode, children }: SectionProps) {
  return (
    <Surface as="section" radius="card" className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h3 id={id} className="kk-body-strong">
          {title}
        </h3>
        <ModeTag mode={mode} />
      </div>
      {children}
    </Surface>
  );
}
