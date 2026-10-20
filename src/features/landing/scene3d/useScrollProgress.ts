import { useThree } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import { useScrollProgress as useDomScrollProgress } from '@/features/motion';

/**
 * Scroll progress of the zone for a WebGL scene: kept in a ref and followed by one invalidate
 * per scroll frame, so neither React nor the canvas re-renders while nothing moves.
 */
export function useScrollProgress(containerRef: RefObject<HTMLElement | null>): RefObject<number> {
  const progress = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  useDomScrollProgress(containerRef, (value) => {
    progress.current = value;
    invalidate();
  });
  return progress;
}
