import styles from './Surface.module.css';

export type SurfaceRadius = 'control' | 'step' | 'source' | 'card';

/**
 * Class names for the shared panel, for elements that cannot be a `Surface` (e.g. router links).
 * The material is the global iOS glass (styles/glass.css): `glass`, plus `glass--read` for
 * containers of long text, tables or methodology. The radius stays the design's own per size.
 */
export function surfaceClassName(radius: SurfaceRadius = 'control', extra?: string, reading = false): string {
  return ['glass', reading && 'glass--read', styles[radius], extra].filter(Boolean).join(' ');
}
