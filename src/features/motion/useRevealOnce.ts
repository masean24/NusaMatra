import { useEffect, useRef, useState, type RefObject } from 'react';
import { observeOnce } from './observeOnce';

/** Figma 43:713: elements appear once when ~20% of them enters the viewport. */
export const DEFAULT_REVEAL_THRESHOLD = 0.2;

export function useRevealOnce<T extends Element>(
  threshold = DEFAULT_REVEAL_THRESHOLD,
  enabled = true,
): { ref: RefObject<T | null>; revealed: boolean } {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    return observeOnce(element, threshold, () => {
      setRevealed(true);
    });
  }, [threshold, enabled]);

  return { ref, revealed };
}
