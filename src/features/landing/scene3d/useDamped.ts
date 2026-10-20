import { useFrame, useThree } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';

/**
 * Eases a value towards a target on each rendered frame and keeps requesting frames only until
 * it settles, which is what lets the canvases use on-demand rendering.
 */
export function useDamped(
  target: RefObject<number>,
  onUpdate: (value: number) => void,
  { smoothing = 8, instant = false }: { smoothing?: number; instant?: boolean } = {},
): void {
  const current = useRef(target.current);
  const invalidate = useThree((state) => state.invalidate);

  useFrame((_, delta) => {
    const goal = target.current;
    const next = instant ? goal : current.current + (goal - current.current) * Math.min(1, delta * smoothing);
    current.current = Math.abs(goal - next) < 1e-4 ? goal : next;
    onUpdate(current.current);
    if (current.current !== goal) invalidate();
  });
}
