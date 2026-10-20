import { animate, stagger, type AnimationPlaybackControls } from 'motion';

/**
 * Marks a block that takes part in the staggered page exit. `Reveal` and the 3D scene zones set
 * it, so every entrance block of the landing page also leaves in order.
 */
export const STAGGER_ITEM_ATTRIBUTE = 'data-stagger-item';
export const STAGGER_ITEM_PROPS = { [STAGGER_ITEM_ATTRIBUTE]: '' } as const;

/** The "Tenang" curve (--nm-ease-calm): quick start, long settle, no overshoot. */
const EASE_CALM = [0.16, 1, 0.3, 1] as const;

/** Exit: blocks lift 12px, shrink slightly and fade, 40ms apart (~0.5s for a full screen). */
const EXIT = { y: -12, scale: 0.96, duration: 0.26, stagger: 0.04 } as const;
/** Enter: blocks rise 24px into place, growing from 96%, 60ms apart. */
const ENTER = { y: 24, scale: 0.96, duration: 0.45, stagger: 0.06 } as const;

/** Blocks on screen now, in reading order, without blocks nested inside another listed block. */
export function visibleStaggerItems(root: ParentNode, last?: Element | null): Element[] {
  const all = Array.from(root.querySelectorAll(`[${STAGGER_ITEM_ATTRIBUTE}]`));
  const onScreen = all.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
  });
  const outermost = onScreen.filter(
    (element) => !onScreen.some((other) => other !== element && other.contains(element)),
  );
  // The block the user acted on leaves last, so the eye ends where the click was.
  const anchor = last ? outermost.find((element) => element.contains(last)) : undefined;
  return anchor ? [...outermost.filter((element) => element !== anchor), anchor] : outermost;
}

/** Staggered vertical fade-and-scale out. Resolves when the last block is gone. */
export async function staggerOut(elements: readonly Element[]): Promise<void> {
  if (elements.length === 0) return;
  await animate(
    [...elements],
    { opacity: [1, 0], y: [0, EXIT.y], scale: [1, EXIT.scale] },
    { duration: EXIT.duration, delay: stagger(EXIT.stagger), ease: EASE_CALM },
  );
}

/**
 * Staggered vertical fade-and-scale in. Every block is hidden synchronously first, so a block
 * waiting for its turn never flashes at full opacity; call it before the first paint.
 */
export function staggerIn(elements: readonly Element[]): AnimationPlaybackControls | null {
  if (elements.length === 0) return null;
  for (const element of elements) {
    if (element instanceof HTMLElement || element instanceof SVGElement) element.style.opacity = '0';
  }
  return animate(
    [...elements],
    { opacity: [0, 1], y: [ENTER.y, 0], scale: [ENTER.scale, 1] },
    { duration: ENTER.duration, delay: stagger(ENTER.stagger), ease: EASE_CALM },
  );
}
