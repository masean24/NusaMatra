import { useLayoutEffect } from 'react';

/** CSS variable on <html>: the width of the scrollbar a page is currently missing, in px. */
export const SCROLLBAR_COMPENSATION_VAR = '--nm-scrollbar-compensation';

/** Width of a classic (space-taking) vertical scrollbar; 0 where scrollbars overlay the page. */
function measureScrollbarWidth(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
  document.body.append(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}

/**
 * Pages that scroll lose a scrollbar's width on the right; a full-screen page (Jelajahi) does not.
 * Centred fixed chrome (the navbar) would jump sideways between them, so this publishes the missing
 * width while a page has no scrollbar, and the chrome centres on the same line on every page.
 * `key` re-checks after each route change; resizes are followed too.
 */
export function useScrollbarCompensation(key: string): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const scrollbar = measureScrollbarWidth();
    if (scrollbar === 0) return;

    const update = () => {
      const missing = window.innerWidth - root.clientWidth === 0 ? scrollbar : 0;
      root.style.setProperty(SCROLLBAR_COMPENSATION_VAR, `${String(missing)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [key]);
}
