import { useCallback, useRef, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { prefersReducedMotion, staggerOut, visibleStaggerItems } from '@/features/motion';

/**
 * Click handler for links that leave the page with the staggered vertical fade-and-scale: the
 * blocks on screen exit one after another (the clicked one last), then the route changes and
 * the new page staggers in (`useStaggeredEnter`). Modified clicks keep the browser's default
 * behaviour, and reduced motion navigates at once.
 */
export function useStaggeredNavigate() {
  const navigate = useNavigate();
  const leaving = useRef(false);

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>, to: string) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (leaving.current) return;
      if (prefersReducedMotion()) {
        void navigate(to);
        return;
      }
      leaving.current = true;
      const main = event.currentTarget.closest('main') ?? document.body;
      void staggerOut(visibleStaggerItems(main, event.currentTarget)).finally(() => {
        leaving.current = false;
        void navigate(to);
      });
    },
    [navigate],
  );
}
