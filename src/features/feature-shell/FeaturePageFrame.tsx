import { useRef, type CSSProperties, type ReactNode } from 'react';
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
  /** Workspace pages only: a narrower cap than 1760px (Lab Prioritas uses 1600px). */
  readonly workspaceMaxWidthPx?: number;
  /** The page draws its own breadcrumb and title (Paspor Bukti); the frame keeps only the column. */
  readonly bare?: boolean;
  /**
   * A full-screen application page (Jelajahi): no column, no padding, and the title and summary
   * kept for screen readers only, since the page's own interface carries them visibly.
   */
  readonly immersive?: boolean;
  readonly children: ReactNode;
}

/** The heading block and column every feature page shares; its blocks stagger in on arrival. */
export function FeaturePageFrame({
  shell,
  wide = false,
  workspace = false,
  workspaceMaxWidthPx,
  bare = false,
  immersive = false,
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
      data-bare={bare || undefined}
      data-immersive={immersive || undefined}
      style={
        workspace && workspaceMaxWidthPx
          ? ({ '--page-workspace-max': `${String(workspaceMaxWidthPx)}px` } as CSSProperties)
          : undefined
      }
    >
      <title>{`${shell.title} — Nusa Matra`}</title>
      {immersive ? (
        <header className="visually-hidden">
          <h1>{shell.title}</h1>
          <p>{shell.summary}</p>
        </header>
      ) : bare ? null : workspace ? (
        <header className={styles.header}>{heading}</header>
      ) : (
        heading
      )}
      {children}
    </div>
  );
}
