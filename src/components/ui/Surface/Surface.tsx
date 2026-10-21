import { useRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { useRefractiveGlass } from '@/lib/glass';
import { surfaceClassName, type SurfaceRadius } from './surfaceClassName';

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly as?: ElementType;
  readonly radius?: SurfaceRadius;
  readonly children: ReactNode;
}

/**
 * The shared panel: an opaque card with the soft Normal shadow, or a thin refractive glass lens in
 * Kaca mode. The mode is applied through tokens, so callers never branch on it.
 */
export function Surface({
  as: Component = 'div',
  radius = 'control',
  className,
  children,
  ...rest
}: SurfaceProps) {
  const ref = useRef<HTMLElement>(null);
  useRefractiveGlass(ref);
  return (
    <Component ref={ref} className={surfaceClassName(radius, className)} {...rest}>
      {children}
    </Component>
  );
}
