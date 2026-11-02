import styles from './Methodology.module.css';

/** Line icons of the method page (24 × 24, drawn in the current text colour). */
const PATHS = {
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  empty: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM5.6 5.6l12.8 12.8',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5',
  scale: 'M12 4v16M5 20h14M5 8h14M5 8l-3 6a3 3 0 0 0 6 0L5 8ZM19 8l-3 6a3 3 0 0 0 6 0l-3-6Z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6M12 7.5h.01',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  pause: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM10 9v6M14 9v6',
  zero: 'M12 4c-3.3 0-5 3.6-5 8s1.7 8 5 8 5-3.6 5-8-1.7-8-5-8ZM4 20 20 4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type MethodIconName = keyof typeof PATHS;

export function MethodIcon({ name }: { readonly name: MethodIconName }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
