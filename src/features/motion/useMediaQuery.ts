import { useCallback, useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query. Returns `false` where matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  const getSnapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
