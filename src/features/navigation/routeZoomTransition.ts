/**
 * macOS-style "open window" page change: the new page zooms out of the clicked card to fill
 * the screen, its corners flattening as it grows, while the old page dims behind it.
 */

/** Short and decisive like a macOS window opening; the curve settles without overshoot. */
const ZOOM_DURATION_MS = 520;
const ZOOM_EASING = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
/** The new page is fully opaque this far into the zoom, so it never looks like a ghost. */
const ZOOM_OPAQUE_AT = 0.3;
/** Smallest starting scale, so a tiny source still opens visibly. */
const MIN_START_SCALE = 0.3;
/** Corner radius of the page while it is still card-sized (matches --nm-radius-card). */
const START_RADIUS_PX = 24;
/**
 * The old page stays in place and only dims, like the desktop behind an opening window.
 * Moving or fading it would uncover the bare canvas around it.
 */
const BACKDROP_BRIGHTNESS = 0.82;

const MODE_ATTRIBUTE = 'data-route-transition';

export interface ZoomSource {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface RouteZoomRequest {
  /** Performs the navigation; resolves once the new page has rendered. */
  readonly navigate: () => Promise<void> | void;
  /** Viewport rectangle of the clicked element the page opens from. */
  readonly source: ZoomSource;
  readonly reducedMotion: boolean;
}

/**
 * Starting transform of the full-viewport page so that it sits, uniformly scaled, centred on the
 * source — like a window that grows from its icon while keeping its own proportions.
 */
export function zoomStartTransform(source: ZoomSource, viewport: { width: number; height: number }): string {
  const scale = Math.min(1, Math.max(MIN_START_SCALE, source.width / viewport.width));
  const dx = source.left + source.width / 2 - viewport.width / 2;
  const dy = source.top + source.height / 2 - viewport.height / 2;
  return `translate(${String(dx)}px, ${String(dy)}px) scale(${String(scale)})`;
}

/**
 * Runs the navigation inside a view transition and drives both page snapshots with the Web
 * Animations API. Reduced motion gets a 200ms crossfade; browsers without the View Transitions
 * API navigate directly.
 */
export async function runRouteZoomTransition({
  navigate,
  source,
  reducedMotion,
}: RouteZoomRequest): Promise<void> {
  if (typeof document.startViewTransition !== 'function') {
    await navigate();
    return;
  }

  const root = document.documentElement;
  root.setAttribute(MODE_ATTRIBUTE, reducedMotion ? 'fade' : 'zoom');
  const transition = document.startViewTransition(async () => {
    await navigate();
  });

  try {
    await transition.ready;
    if (!reducedMotion) {
      const timing = { duration: ZOOM_DURATION_MS, easing: ZOOM_EASING, fill: 'both' } as const;
      root.animate(
        [
          {
            transform: zoomStartTransform(source, { width: window.innerWidth, height: window.innerHeight }),
            clipPath: `inset(0 round ${String(START_RADIUS_PX)}px)`,
            opacity: 0,
          },
          { opacity: 1, offset: ZOOM_OPAQUE_AT },
          { transform: 'none', clipPath: 'inset(0 round 0px)', opacity: 1 },
        ],
        { ...timing, pseudoElement: '::view-transition-new(root)' },
      );
      root.animate([{ filter: 'brightness(1)' }, { filter: `brightness(${String(BACKDROP_BRIGHTNESS)})` }], {
        ...timing,
        pseudoElement: '::view-transition-old(root)',
      });
    }
    await transition.finished;
  } catch {
    // A skipped or failed transition still navigated (or reported its own error); nothing to undo.
  } finally {
    root.removeAttribute(MODE_ATTRIBUTE);
  }
}
