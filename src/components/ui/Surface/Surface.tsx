import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { surfaceClassName, type SurfaceRadius } from './surfaceClassName';

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly as?: ElementType;
  readonly radius?: SurfaceRadius;
  readonly children: ReactNode;
}

/**
 * The shared panel: an opaque card with the soft Normal shadow, or translucent glass with a
 * white stroke in Kaca mode. The mode is applied through tokens, so callers never branch on it.
 */
export function Surface({
  as: Component = 'div',
  radius = 'control',
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <Component className={surfaceClassName(radius, className)} {...rest}>
      {children}
    </Component>
  );
}
