import { useLayoutEffect, type RefObject } from 'react';
import { prefersReducedMotion } from './useReducedMotion';
import { staggerIn } from './staggerTransition';

/**
 * Brings a page's top-level blocks in with the staggered vertical fade-and-scale on mount.
 * Runs before the first paint so nothing flashes; reduced motion shows the page as it is.
 */
export function useStaggeredEnter(containerRef: RefObject<HTMLElement | null>, key: string): void {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion()) return;
    const controls = staggerIn(Array.from(container.children));
    return () => {
      controls?.complete();
    };
  }, [containerRef, key]);
}
