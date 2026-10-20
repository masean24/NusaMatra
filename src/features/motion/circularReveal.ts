/**
 * The circular reveal of the Normal ↔ Kaca switch:
 * 0.75s on the Figma 30:1467 liquid curve, inside the requested 0.6–0.9s.
 */
export const REVEAL_DURATION_MS = 750;
export const REVEAL_EASE = [0.65, 0, 0.35, 1] as const;
/** Reduced motion: a short crossfade, no moving shape. */
export const REDUCED_DURATION_MS = 200;

export interface RevealOrigin {
  readonly x: number;
  readonly y: number;
}

/** Radius that reaches the farthest viewport corner from the origin. */
export function coverRadius({ x, y }: RevealOrigin): number {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

/** `clip-path` keyframes growing a circle from the origin until it covers the viewport. */
export function revealClipPath(origin: RevealOrigin): [string, string] {
  const at = `at ${String(origin.x)}px ${String(origin.y)}px`;
  return [`circle(0px ${at})`, `circle(${String(coverRadius(origin))}px ${at})`];
}
