import { useEffect } from 'react';
import { prefersReducedMotion } from '@/features/motion';

/**
 * Every link to a place on the same page (`href="#…"`: the passport's contents, "Baca batasan",
 * the Lab's "tidak diperingkat" count) glides there instead of jumping (owner decision 2026-10-27),
 * and moves focus with it, as the jump would. Reduced motion keeps the instant jump. The hash is
 * written with replaceState, so the back button still leaves the page rather than walking the
 * anchors. One delegated listener covers links rendered later as well.
 */
export function useSmoothHashLinks(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      const id = link ? decodeURIComponent(link.getAttribute('href')?.slice(1) ?? '') : '';
      const target = id ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, select, textarea')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
      window.history.replaceState(window.history.state, '', `#${id}`);
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
    };
  }, []);
}
