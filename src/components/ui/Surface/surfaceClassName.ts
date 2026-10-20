import styles from './Surface.module.css';

export type SurfaceRadius = 'control' | 'step' | 'source' | 'card';

/** Class names for the shared panel, for elements that cannot be a `Surface` (e.g. router links). */
export function surfaceClassName(radius: SurfaceRadius = 'control', extra?: string): string {
  return [styles.surface, styles[radius], extra].filter(Boolean).join(' ');
}
