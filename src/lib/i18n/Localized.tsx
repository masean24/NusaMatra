import type { ReactElement } from 'react';
import { useLanguage } from './useLanguage';

/**
 * Draws its content again when the language changes. A route's element is created once, so React
 * would skip everything under it; building the element here makes the whole page render again while
 * keeping its state, because the component types stay the same and nothing remounts.
 */
export function Localized({ render }: { readonly render: () => ReactElement }) {
  useLanguage();
  return render();
}
