import { useEffect, type RefObject } from 'react';
import { prefersReducedMotion } from '@/features/motion';

/** Scrolled further than this, the bar folds; it unfolds again above the lower mark (no flicker). */
const COMPACT_FROM = 48;
const EXPAND_BELOW = 16;
const DURATION_MS = 420;
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Folds the desktop navbar once the page scrolls: it narrows to its content around the same centre,
 * the wordmark fading to the logo mark, the links and mode switch kept. CSS holds both states
 * (`data-compact`); the change between them is animated here with measured widths, because a width
 * of "fit the content" cannot be transitioned in CSS in every browser. Reduced motion switches at once.
 */
export function useCompactOnScroll(barRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const wordmark = bar.querySelector<HTMLElement>('[data-wordmark]');
    let compact = false;
    let frame = 0;

    const apply = (next: boolean) => {
      compact = next;
      const animate = !prefersReducedMotion() && bar.getBoundingClientRect().width > 0;
      const from = bar.getBoundingClientRect().width;
      const wordFrom = wordmark?.getBoundingClientRect().width ?? 0;
      bar.getAnimations().forEach((animation) => {
        animation.cancel();
      });
      wordmark?.getAnimations().forEach((animation) => {
        animation.cancel();
      });
      bar.toggleAttribute('data-compact', next);
      if (!animate) return;
      const to = bar.getBoundingClientRect().width;
      const wordTo = wordmark?.getBoundingClientRect().width ?? 0;
      const timing = { duration: DURATION_MS, easing: EASE };
      bar.animate([{ width: `${String(from)}px` }, { width: `${String(to)}px` }], timing);
      wordmark?.animate(
        [
          { maxWidth: `${String(wordFrom)}px`, opacity: next ? 1 : 0 },
          { maxWidth: `${String(wordTo)}px`, opacity: next ? 0 : 1 },
        ],
        timing,
      );
    };

    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (!compact && y > COMPACT_FROM) apply(true);
      else if (compact && y < EXPAND_BELOW) apply(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [barRef]);
}
