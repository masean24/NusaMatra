import { useEffect } from 'react';
import { preloadExploreEngine } from '@/features/geo3d';

const EXPLORE_PATH = '/jelajahi';
const INTENT_EVENTS = ['pointerover', 'focusin', 'touchstart'] as const;

let started = false;

/** Starts downloading the Jelajahi page and its map engine; later calls do nothing. */
function preloadExplore(): void {
  if (started) return;
  started = true;
  void import('./pages/ExplorePage');
  void preloadExploreEngine();
}

/**
 * Jelajahi is the heaviest page (its code and the 3D map engine). Its download starts as soon as a
 * pointer rests on, or keyboard focus reaches, any link to it, so a click finds it ready instead
 * of waiting on the network with the old page still on screen.
 */
export function usePreloadExploreOnIntent(): void {
  useEffect(() => {
    const onIntent = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`a[href^="${EXPLORE_PATH}"]`)) preloadExplore();
    };
    for (const type of INTENT_EVENTS) document.addEventListener(type, onIntent, { passive: true });
    return () => {
      for (const type of INTENT_EVENTS) document.removeEventListener(type, onIntent);
    };
  }, []);
}
