import type { CSSProperties, ElementType, ReactNode } from 'react';
import { DEFAULT_REVEAL_THRESHOLD, useRevealOnce } from './useRevealOnce';
import { STAGGER_ITEM_PROPS } from './staggerTransition';
import styles from './Reveal.module.css';

interface RevealProps {
  readonly children: ReactNode;
  readonly as?: ElementType;
  /** Upward travel in px (Figma: 16–32px; G1 28px, G3 24px, G11 32px). */
  readonly distance?: number;
  /** Horizontal travel in px, for G3's "from the left" steps. */
  readonly fromX?: number;
  /** Stagger delay in ms (Figma: 80–100ms between siblings). */
  readonly delay?: number;
  readonly duration?: number;
  readonly threshold?: number;
  /** Scale at the start, for G5's 0.96 → 1 surface. */
  readonly fromScale?: number;
  /**
   * `view` (default) waits until the element scrolls into view; `load` plays at first paint, for
   * the hero (G1/G2 "saat halaman dimuat"), so it never waits on an observer callback.
   */
  readonly trigger?: 'view' | 'load';
  readonly className?: string | undefined;
}

/**
 * One-time entrance: translate + fade on the "Tenang" curve. Content is visible by default and
 * only hidden once JavaScript has run (`html.js`), and reduced motion shows it without movement.
 */
export function Reveal({
  children,
  as: Component = 'div',
  distance = 24,
  fromX = 0,
  delay = 0,
  duration = 700,
  threshold = DEFAULT_REVEAL_THRESHOLD,
  fromScale = 1,
  trigger = 'view',
  className,
}: RevealProps) {
  const { ref, revealed } = useRevealOnce<HTMLElement>(threshold, trigger === 'view');
  const style = {
    '--reveal-y': `${distance}px`,
    '--reveal-x': `${fromX}px`,
    '--reveal-scale': fromScale,
    '--reveal-delay': `${delay}ms`,
    '--reveal-duration': `${duration}ms`,
  } as CSSProperties;

  return (
    <Component
      ref={ref}
      className={[styles.reveal, trigger === 'load' ? styles.onLoad : undefined, className]
        .filter(Boolean)
        .join(' ')}
      data-revealed={trigger === 'load' ? true : revealed}
      {...STAGGER_ITEM_PROPS}
      style={style}
    >
      {children}
    </Component>
  );
}
