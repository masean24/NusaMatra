import { useRef, type ReactNode } from 'react';
import { useStaggeredEnter } from '@/features/motion';
import { BackToHubLink } from '@/features/navigation';
import type { FeatureShell } from './featureShells';
import styles from './FeaturePageFrame.module.css';

interface FeaturePageFrameProps {
  readonly shell: FeatureShell;
  /** Map and data pages use the wide 1120px column; text pages the narrow one. */
  readonly wide?: boolean;
  readonly children: ReactNode;
}

/** The heading block and column every feature page shares; its blocks stagger in on arrival. */
export function FeaturePageFrame({ shell, wide = false, children }: FeaturePageFrameProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  useStaggeredEnter(pageRef, shell.path);

  return (
    <div ref={pageRef} className={styles.page} data-wide={wide || undefined}>
      <title>{`${shell.title} — Nusa Matra`}</title>
      {shell.path !== '/peta' && <BackToHubLink />}
      <h1 className="kk-h1">{shell.title}</h1>
      <p className={`kk-lead ${styles.summary}`}>{shell.summary}</p>
      {children}
    </div>
  );
}
