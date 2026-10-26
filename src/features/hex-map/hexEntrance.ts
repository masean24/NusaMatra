/**
 * The "jitter entrance" of the hex map as pure functions of time. Every cell's delay and shake
 * pattern is generated once from a seed, so the animation is identical on every visit and one
 * render loop can evaluate all cells without a tween per cell.
 */
const ENTRANCE_SEED = 20261021;
/** Delays are spread over this span; with `CELL_DURATION_MS` the whole entrance is about 1 s. */
export const DELAY_SPREAD_MS = 750;
export const CELL_DURATION_MS = 250;
export const ENTRANCE_TOTAL_MS = DELAY_SPREAD_MS + CELL_DURATION_MS;
/** How strongly the delay follows west → east (the rest is random). */
const WEST_TO_EAST_WEIGHT = 0.7;
/** Largest shake offset in world units (degrees) before easing out. */
const SHAKE_XZ = 0.22;
const SHAKE_Y = 0.3;
/** Scale keyframes over the cell's own time: 0 → 1.15 → 0.9 → 1.05 → 1. */
const SCALE_KEYS = [
  [0, 0],
  [0.35, 1.15],
  [0.6, 0.9],
  [0.8, 1.05],
  [1, 1],
] as const;

export interface CellEntrance {
  /** Start of this cell's own animation, in ms after the entrance begins. */
  readonly delay: number;
  /** 3–5 random offsets, visited one after another while the cell settles. */
  readonly shakes: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /** Moments (0–1 of the cell's duration) at which its opacity dips: 1–2 blinks. */
  readonly blinks: readonly number[];
}

export interface CellPose {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly offsetZ: number;
  readonly scale: number;
  readonly opacity: number;
}

export const SETTLED_POSE: CellPose = { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, opacity: 1 };

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One entrance pattern per cell; `xs` are the cells' east–west positions in any unit. */
export function buildEntranceSchedule(xs: readonly number[], seed = ENTRANCE_SEED): CellEntrance[] {
  const random = mulberry32(seed);
  const west = Math.min(...xs);
  const span = Math.max(...xs) - west || 1;
  return xs.map((x) => {
    const eastness = (x - west) / span;
    const delay = DELAY_SPREAD_MS * (WEST_TO_EAST_WEIGHT * eastness + (1 - WEST_TO_EAST_WEIGHT) * random());
    const shakeCount = 3 + Math.floor(random() * 3);
    const shakes = Array.from({ length: shakeCount }, () => ({
      x: (random() * 2 - 1) * SHAKE_XZ,
      y: (random() * 2 - 1) * SHAKE_Y,
      z: (random() * 2 - 1) * SHAKE_XZ,
    }));
    const blinkCount = 1 + Math.floor(random() * 2);
    const blinks = Array.from({ length: blinkCount }, () => 0.15 + random() * 0.6);
    return { delay, shakes, blinks };
  });
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

function scaleAt(progress: number): number {
  for (let index = 1; index < SCALE_KEYS.length; index += 1) {
    const previous = SCALE_KEYS[index - 1];
    const next = SCALE_KEYS[index];
    if (previous && next && progress <= next[0]) {
      const t = (progress - previous[0]) / (next[0] - previous[0]);
      return previous[1] + (next[1] - previous[1]) * easeInOut(t);
    }
  }
  return 1;
}

/** The cell's pose `elapsedMs` after the entrance began. */
export function evaluateEntrance(cell: CellEntrance, elapsedMs: number): CellPose {
  const local = elapsedMs - cell.delay;
  if (local <= 0) return { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 0, opacity: 0 };
  if (local >= CELL_DURATION_MS) return SETTLED_POSE;

  const progress = local / CELL_DURATION_MS;
  // The shake runs through the first 80% and fades out, so the cell lands exactly on its grid slot.
  const shakeProgress = Math.min(1, progress / 0.8);
  const slot = shakeProgress * cell.shakes.length;
  const index = Math.min(cell.shakes.length - 1, Math.floor(slot));
  const current = cell.shakes[index];
  const previous = cell.shakes[index - 1];
  const t = easeInOut(slot - index);
  const fromX = previous?.x ?? 0;
  const fromY = previous?.y ?? 0;
  const fromZ = previous?.z ?? 0;
  const calm = 1 - easeInOut(shakeProgress);
  const offsetX = (fromX + ((current?.x ?? 0) - fromX) * t) * calm;
  const offsetY = (fromY + ((current?.y ?? 0) - fromY) * t) * calm;
  const offsetZ = (fromZ + ((current?.z ?? 0) - fromZ) * t) * calm;

  const fadeIn = Math.min(1, progress / 0.4);
  const dip = cell.blinks.reduce((deepest, blink) => {
    const distance = Math.abs(progress - blink);
    return Math.max(deepest, distance < 0.08 ? 1 - distance / 0.08 : 0);
  }, 0);
  return { offsetX, offsetY, offsetZ, scale: scaleAt(progress), opacity: fadeIn * (1 - 0.7 * dip) };
}

export const REDUCED_FADE_MS = 500;

/** Reduced motion: every cell is in place and only fades in, with no shaking or scaling. */
export function evaluateReducedEntrance(elapsedMs: number): CellPose {
  const opacity = Math.min(1, Math.max(0, elapsedMs / REDUCED_FADE_MS));
  return { ...SETTLED_POSE, opacity, scale: opacity > 0 ? 1 : 0 };
}
