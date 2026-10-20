import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { prefersReducedMotion } from '@/features/motion';
import { runRouteZoomTransition } from './routeZoomTransition';

/**
 * Click handler for a link whose page opens by zooming out of the link itself (see
 * `runRouteZoomTransition`). Modified clicks (new tab, new window, download) keep the
 * browser's default behaviour.
 */
export function useRouteZoom() {
  const navigate = useNavigate();

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>, to: string) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void runRouteZoomTransition({
        // flushSync: the new page must be in the DOM when the browser snapshots it.
        navigate: () => navigate(to, { flushSync: true }),
        source: event.currentTarget.getBoundingClientRect(),
        reducedMotion: prefersReducedMotion(),
      });
    },
    [navigate],
  );
}
