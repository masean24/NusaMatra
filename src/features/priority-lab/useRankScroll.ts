import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '@/features/motion';

/**
 * Keeps the ranking card at the height of its first page: the list box is capped at the height of
 * the first `pageSize` rows (with their breakdowns closed), and rows added by "Tampilkan lagi"
 * scroll inside it. The first added row is brought into view, so the reader sees what appeared.
 */
export function useRankScroll(rowCount: number, pageSize: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingReveal = useRef<number | null>(null);
  const [capPx, setCapPx] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const measure = () => {
      const items = Array.from(box.querySelector('ol')?.children ?? []).slice(0, pageSize);
      const last = items[items.length - 1];
      if (items.length < pageSize || !(last instanceof HTMLElement)) {
        setCapPx(null);
        return;
      }
      // A row is its button plus, when open, its breakdown; open breakdowns do not count.
      const openDetails = items.reduce((sum, item) => {
        const detail = item.children[1];
        return sum + (detail instanceof HTMLElement ? detail.offsetHeight : 0);
      }, 0);
      const height = last.offsetTop + last.offsetHeight - openDetails;
      // Layout engines without boxes (tests) measure 0: no cap then.
      setCapPx(height > 0 ? Math.ceil(height) + 2 : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    let width = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      measure();
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
    };
  }, [rowCount, pageSize]);

  // After more rows were added, show the first of them at the top of the box.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    const index = pendingReveal.current;
    if (!box || index === null) return;
    pendingReveal.current = null;
    const row = box.querySelector('ol')?.children[index];
    if (!(row instanceof HTMLElement)) return;
    const top = row.offsetTop;
    if (typeof box.scrollTo === 'function')
      box.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
    else box.scrollTop = top;
  }, [rowCount, reducedMotion]);

  /** Call before showing more rows: the row at `index` (the first new one) is scrolled into view. */
  const revealFrom = useCallback((index: number) => {
    pendingReveal.current = index;
  }, []);

  /** A new view (order, search, filter) starts at the top of the list. */
  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const style: CSSProperties | undefined = capPx === null ? undefined : { maxHeight: `${String(capPx)}px` };
  return { scrollRef, style, revealFrom, resetScroll };
}
