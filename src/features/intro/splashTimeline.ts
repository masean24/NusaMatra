/** Times of the opening, in milliseconds from its start. CSS holds the steps that only run on their own. */
export const PROGRESS_START_MS = 800;
export const PROGRESS_DURATION_MS = 1800;
/** Progress may wait at this fraction for the page to be ready, but never past the time limit. */
export const PROGRESS_HOLD = 0.9;
export const READY_TIMEOUT_MS = 3000;

/** From the start of the exit: the overlay begins to fade here, and is removed there. */
export const PORTAL_AFTER_MS = 150;
export const EXIT_MS = 1000;

/** Reduced motion: the still opening shows for 1.2 s and fades in 0.4 s. */
export const REDUCED_HOLD_MS = 1200;
export const REDUCED_FADE_MS = 400;

const STATUS_COUNT = 3;

export interface SplashProgress {
  /** 0 to 1. */
  readonly fraction: number;
  /** Which status text shows, one for each third of the time. */
  readonly statusIndex: number;
  readonly finished: boolean;
}

/** Where progress stands: a smoothstep over its time, held near the end until the page is ready. */
export function progressAt(elapsedMs: number, ready: boolean): SplashProgress {
  const time = Math.min(1, Math.max(0, (elapsedMs - PROGRESS_START_MS) / PROGRESS_DURATION_MS));
  const eased = time * time * (3 - 2 * time);
  const waiting = !ready && elapsedMs < READY_TIMEOUT_MS;
  return {
    fraction: waiting ? Math.min(eased, PROGRESS_HOLD) : eased,
    statusIndex: Math.min(STATUS_COUNT - 1, Math.floor(time * STATUS_COUNT)),
    finished: time === 1 && !waiting,
  };
}
