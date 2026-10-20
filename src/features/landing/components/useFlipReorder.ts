import { useLayoutEffect, useRef } from 'react';

/**
 * FLIP for a keyed list: before each commit the rows' last positions are kept; after the commit
 * every row that moved is animated from its old place to its new one with transform only.
 */
export function useFlipReorder(orderKey: string, durationMs: number, easing: string, disabled: boolean) {
  const rows = useRef(new Map<string, HTMLElement>());
  const lastTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const previous = lastTops.current;
    const next = new Map<string, number>();
    rows.current.forEach((element, key) => {
      const top = element.getBoundingClientRect().top;
      next.set(key, top);
      const before = previous.get(key);
      if (disabled || before === undefined || before === top) return;
      element.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], {
        duration: durationMs,
        easing,
      });
    });
    lastTops.current = next;
  }, [orderKey, durationMs, easing, disabled]);

  return (key: string) => (element: HTMLElement | null) => {
    if (element) rows.current.set(key, element);
    else rows.current.delete(key);
  };
}
