import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { surfaceClassName, type SurfaceRadius } from './surfaceClassName';

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly as?: ElementType;
  readonly radius?: SurfaceRadius;
  /** Long paragraphs, tables or methodology: the denser `glass--read` material. */
  readonly reading?: boolean;
  readonly children: ReactNode;
}

/**
 * The shared panel: iOS-style glass in both display modes (light glass over kapur in Normal, dark
 * glass over the Kaca page). The mode is applied through tokens, so callers never branch on it.
 */
export function Surface({
  as: Component = 'div',
  radius = 'control',
  reading = false,
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <Component className={surfaceClassName(radius, className, reading)} {...rest}>
      {children}
    </Component>
  );
}
