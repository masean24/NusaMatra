import type { ReactNode } from 'react';
import { Surface } from '@/components/ui/Surface/Surface';
import { publicConfig } from '@/lib/publicConfig';
import type { DataMode } from '@/services/api';
import styles from './EvidencePassport.module.css';

/**
 * LIVE or DEMO as words in a chip: it must read on screen, in print, and without colour. DEMO keeps
 * the warning style and its "data simulasi" so a cropped screenshot cannot pass for official data.
 * LIVE is the only mode visitors see, so its chip shows only where the mode switch is on (tests); the
 * passport's integrity facts still name the mode.
 */
export function ModeTag({ mode }: { readonly mode: DataMode }) {
  if (mode === 'LIVE' && !publicConfig.modeSwitch) return null;
  return mode === 'LIVE' ? (
    <span className={styles.modeChip}>
      <span className={styles.modeDot} aria-hidden="true" />
      LIVE
    </span>
  ) : (
    <span className={`${styles.modeChip} ${styles.tagWarn}`}>DEMO · data simulasi</span>
  );
}

interface SectionProps {
  readonly id: string;
  readonly title: string;
  /** The mode the record was actually received in; repeated in every section. */
  readonly mode: DataMode;
  /** One sentence under the title. */
  readonly description?: string;
  /** A small count chip after the title, e.g. "9 batasan". */
  readonly badge?: string;
  /** Right-aligned metadata in the heading row, e.g. the receive time. */
  readonly meta?: ReactNode;
  /** Without a card: the heading and its content sit on the page (the trust overview). */
  readonly plain?: boolean;
  readonly children: ReactNode;
}

export function Section({
  id,
  title,
  mode,
  description,
  badge,
  meta,
  plain = false,
  children,
}: SectionProps) {
  const head = (
    <div className={styles.sectionHead}>
      <div className={styles.sectionHeadMain}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        <ModeTag mode={mode} />
        {badge && <span className={styles.countChip}>{badge}</span>}
      </div>
      {meta && <p className={styles.sectionMeta}>{meta}</p>}
      {description && <p className={styles.sectionDescription}>{description}</p>}
    </div>
  );
  if (plain) {
    return (
      <section className={styles.plainSection} aria-labelledby={id}>
        {head}
        {children}
      </section>
    );
  }
  return (
    <Surface as="section" radius="card" className={styles.section} aria-labelledby={id}>
      {head}
      {children}
    </Surface>
  );
}
