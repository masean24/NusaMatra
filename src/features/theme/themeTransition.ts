import { animateView } from 'motion';

export interface ThemeTransitionRequest {
  /** Synchronously paints the new theme (state + `data-display-mode`). */
  readonly apply: () => void;
  /** Centre of the toggle in viewport coordinates; the reveal grows from here. */
  readonly originX: number;
  readonly originY: number;
  readonly reducedMotion: boolean;
}

/** 0.75s on an ease-in-out curve (Figma 30:1467 liquid curve), inside the requested 0.6–0.9s. */
const REVEAL_SECONDS = 0.75;
const REVEAL_EASE = [0.65, 0, 0.35, 1] as const;
/** Reduced motion: a short crossfade, no moving shape. */
const REDUCED_SECONDS = 0.2;
const FALLBACK_ATTRIBUTE = 'data-theme-transition';

/** Radius that reaches the farthest viewport corner from the origin. */
function coverRadius(x: number, y: number): number {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

/**
 * Browsers without the View Transitions API: the theme switches under a CSS crossfade of
 * colours, borders, shadows and the page gradient (see `theme.css`), never a hard cut.
 */
function crossfade(apply: () => void, seconds: number): Promise<void> {
  const root = document.documentElement;
  root.style.setProperty('--theme-transition-duration', `${seconds}s`);
  root.setAttribute(FALLBACK_ATTRIBUTE, 'crossfade');
  apply();
  return new Promise((resolve) => {
    window.setTimeout(() => {
      root.removeAttribute(FALLBACK_ATTRIBUTE);
      root.style.removeProperty('--theme-transition-duration');
      resolve();
    }, seconds * 1000);
  });
}

/**
 * Circular reveal: the browser snapshots the current page, the new theme is painted live
 * underneath, and Motion grows a `clip-path: circle()` on the new layer from the toggle.
 * The old page stays fully visible outside the circle, so no frame is ever empty or a
 * solid colour; every element keeps its position and size because only paint changes.
 */
export async function runThemeTransition({
  apply,
  originX,
  originY,
  reducedMotion,
}: ThemeTransitionRequest): Promise<void> {
  if (typeof document.startViewTransition !== 'function') {
    await crossfade(apply, reducedMotion ? REDUCED_SECONDS : REVEAL_SECONDS);
    return;
  }

  if (reducedMotion) {
    await animateView(apply, { duration: REDUCED_SECONDS, ease: 'easeOut' })
      .new({ opacity: [0, 1] })
      .old({ opacity: [1, 0] });
    return;
  }

  const at = `at ${originX}px ${originY}px`;
  await animateView(apply, { duration: REVEAL_SECONDS, ease: REVEAL_EASE })
    .new({ clipPath: [`circle(0px ${at})`, `circle(${coverRadius(originX, originY)}px ${at})`] })
    // The old snapshot stays fully opaque under the growing circle.
    .old({ opacity: [1, 1] });
}
