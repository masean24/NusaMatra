import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { clearRefraction, refractElement } from '@/lib/glass/glassFilters';
import { useRefractionEnabled } from '@/lib/glass';

/**
 * One spring for every travel distance: stiff enough to answer a click at once, damped enough to
 * settle with only a trace of give. Retargeting mid-flight keeps the current velocity.
 */
const INDICATOR_SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 } as const;
const REDUCED_MOTION_TRANSITION = { duration: 0.12, ease: 'easeOut' } as const;
const FADE_TRANSITION = { duration: 0.16, ease: 'easeOut' } as const;

interface Geometry {
  readonly x: number;
  readonly width: number;
}

function measureTarget(list: HTMLElement, targetKey: string): Geometry | null {
  const element = Array.from(list.querySelectorAll<HTMLElement>('[data-nav-key]')).find(
    (candidate) => candidate.dataset['navKey'] === targetKey,
  );
  if (!element) return null;
  const listBox = list.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return { x: box.left - listBox.left, width: box.width };
}

/**
 * The pill changes width as it travels, so its lens is built per destination width (a handful of
 * cached maps) and swapped in when the target changes; mid-flight it is at most a few px off.
 */
function refractPill(pill: HTMLElement | null, enabled: boolean, targetWidth: number): void {
  if (!pill) return;
  if (!enabled) {
    clearRefraction(pill);
    return;
  }
  const width = Math.round(targetWidth);
  const height = Math.round(pill.offsetHeight);
  if (width < 8 || height < 8) return;
  refractElement(pill, `nm-glass-pill-${String(width)}x${String(height)}`, width, height, height / 2);
}

/**
 * Moves ONE shared pill to the element whose `data-nav-key` equals `targetKey` (the hovered or
 * focused item, else the current route). The pill is driven through motion values, so pointer
 * movement never re-renders React; only a change of target starts an animation.
 */
export function useSlidingIndicator(
  listRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  targetKey: string | null,
) {
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const opacity = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const visible = useRef(false);
  const refractionEnabled = useRefractionEnabled();

  // Latest target for the resize observer, which must not re-subscribe on every change.
  const targetRef = useRef(targetKey);
  useLayoutEffect(() => {
    targetRef.current = targetKey;
  }, [targetKey]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const geometry = targetKey === null ? null : measureTarget(list, targetKey);

    if (geometry) refractPill(pillRef.current, refractionEnabled, geometry.width);
    if (!geometry) {
      // No route in the bar (e.g. the landing page): fade out in place, never slide away.
      visible.current = false;
      animate(opacity, 0, FADE_TRANSITION);
      return;
    }

    if (!visible.current) {
      // First appearance, or returning from "nothing selected": appear where it belongs instead of
      // flying in from the left edge.
      x.jump(geometry.x);
      width.jump(geometry.width);
      visible.current = true;
      animate(opacity, 1, FADE_TRANSITION);
      return;
    }

    // A later animation on the same value replaces this one, so retargeting needs no cleanup.
    const transition = reduceMotion ? REDUCED_MOTION_TRANSITION : INDICATOR_SPRING;
    animate(x, geometry.x, transition);
    animate(width, geometry.width, transition);
    animate(opacity, 1, FADE_TRANSITION);
  }, [listRef, pillRef, targetKey, x, width, opacity, reduceMotion, refractionEnabled]);

  // Fonts, zoom and breakpoints change item boxes without changing the target: snap, don't glide.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      const key = targetRef.current;
      const geometry = key === null ? null : measureTarget(list, key);
      if (!geometry) return;
      x.jump(geometry.x);
      width.jump(geometry.width);
      refractPill(pillRef.current, refractionEnabled, geometry.width);
    });
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [listRef, pillRef, x, width, refractionEnabled]);

  return { x, width, opacity };
}
