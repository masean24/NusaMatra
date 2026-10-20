import { useEffect, useEffectEvent, type RefObject } from 'react';

/**
 * 0 → 1 progress of an element through the viewport under native scroll (no hijacking):
 * 0 while its top is still in the lower 10% of the screen, 1 once it has mostly passed the top.
 */
export function measureScrollProgress(box: DOMRect, viewportHeight: number): number {
  const start = viewportHeight * 0.9;
  const end = viewportHeight * 0.1 - box.height * 0.35;
  return Math.min(1, Math.max(0, (start - box.top) / (start - end)));
}

/** Reports scroll progress at most once per frame; never re-renders by itself. */
export function useScrollProgress(
  elementRef: RefObject<Element | null>,
  onProgress: (progress: number) => void,
): void {
  const report = useEffectEvent(onProgress);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = elementRef.current;
      if (element) report(measureScrollProgress(element.getBoundingClientRect(), window.innerHeight));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [elementRef]);
}
