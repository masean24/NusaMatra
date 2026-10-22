import { useRef, type ReactNode } from 'react';
import { useStaggeredEnter } from '@/features/motion';
import { BackToHubLink } from '@/features/navigation';
import type { FeatureShell } from './featureShells';
import styles from './FeaturePageFrame.module.css';

interface FeaturePageFrameProps {
  readonly shell: FeatureShell;
  /** Map and data pages use the wide 1120px column; text pages the narrow one. */
  readonly wide?: boolean;
  /**
   * Map-first pages (Jelajahi): a 1760px workspace with the heading compacted into one band, so the
   * map is in the first viewport. Takes precedence over `wide`.
   */
  readonly workspace?: boolean;
  readonly children: ReactNode;
}

/** The heading block and column every feature page shares; its blocks stagger in on arrival. */
export function FeaturePageFrame({
  shell,
  wide = false,
  workspace = false,
  children,
}: FeaturePageFrameProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  useStaggeredEnter(pageRef, shell.path);

  const heading = (
    <>
      {shell.path !== '/peta' && <BackToHubLink />}
      <h1 className="kk-h1">{shell.title}</h1>
      <p className={`kk-lead ${styles.summary}`}>{shell.summary}</p>
    </>
  );

  return (
    <div
      ref={pageRef}
      className={styles.page}
      data-wide={(wide && !workspace) || undefined}
      data-workspace={workspace || undefined}
    >
      <title>{`${shell.title} — Nusa Matra`}</title>
      {workspace ? <header className={styles.header}>{heading}</header> : heading}
      {children}
    </div>
  );
}
