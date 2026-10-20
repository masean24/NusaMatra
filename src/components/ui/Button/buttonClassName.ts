import styles from './Button.module.css';

/**
 * Figma 26:14 "KK Tombol". `accent` = primary action, `glass` = action on sea/glass, `outline` = "Garis".
 * `secondary` follows the design's own pairing: Garis in Normal mode, Kaca in Kaca mode.
 */
export type ButtonVariant = 'accent' | 'glass' | 'outline' | 'secondary';

export function buttonClassName(variant: ButtonVariant, extra?: string): string {
  return [styles.button, styles[variant], extra].filter(Boolean).join(' ');
}
