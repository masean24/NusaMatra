import { useEffect, useId, useSyncExternalStore, type RefObject } from 'react';
import {
  clearRefraction,
  refractElement,
  removeRefractionFilter,
  supportsBackdropRefraction,
} from './glassFilters';

function subscribeToDisplayMode(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-display-mode', 'data-quality'],
  });
  return () => {
    observer.disconnect();
  };
}

const isGlassMode = () => document.documentElement.getAttribute('data-display-mode') === 'glass';

/** True while Kaca is painted. Read straight from the document, so it needs no provider. */
export function useGlassMode(): boolean {
  return useSyncExternalStore(subscribeToDisplayMode, isGlassMode, () => false);
}

/** The "Ringan" graphics level (<html data-quality="lite">) asks for the cheaper glass. */
const isLiteQuality = () => document.documentElement.getAttribute('data-quality') === 'lite';

/** Refraction is drawn only where Chromium can render it, only in Kaca, and not at the "Ringan" level. */
export function useRefractionEnabled(): boolean {
  const lite = useSyncExternalStore(subscribeToDisplayMode, isLiteQuality, () => false);
  return useGlassMode() && !lite && supportsBackdropRefraction();
}

export function cornerRadius(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
}

/**
 * Makes `element`'s backdrop refract at its rounded edge (Chromium, Kaca only). It builds a
 * displacement map for the element's current size and exposes it as `--glass-refraction`, which the
 * element's CSS puts in front of its `backdrop-filter`. Elsewhere it does nothing and the CSS-only
 * glass remains.
 */
export function useRefractiveGlass(ref: RefObject<HTMLElement | null>): void {
  const enabled = useRefractionEnabled();
  const filterId = `nm-glass-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    let frame = 0;
    const apply = () => {
      const width = Math.round(element.offsetWidth);
      const height = Math.round(element.offsetHeight);
      if (width < 8 || height < 8) return;
      refractElement(element, filterId, width, height, cornerRadius(element));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    apply();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clearRefraction(element);
      removeRefractionFilter(filterId);
    };
  }, [ref, enabled, filterId]);
}
