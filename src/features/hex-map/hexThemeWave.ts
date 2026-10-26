/**
 * The Normal ⇄ Kaca transition of the hex map, as pure functions of time. A wave travels west to
 * east: each tile blends to the new palette, rises a little and leans into the travel direction,
 * and catches a soft highlight while it changes. It is separate from the entrance animation and
 * never hides a tile, so the map stays recognisable throughout.
 */
/** The wave front crosses the map in this long; each tile then takes `TILE_MS` to change. */
export const WAVE_SPREAD_MS = 700;
export const TILE_MS = 600;
export const THEME_TOTAL_MS = WAVE_SPREAD_MS + TILE_MS;
/** Reduced motion: every tile cross-fades together, with no lift, lean or highlight. */
export const REDUCED_THEME_MS = 300;
/** The page's liquid reveal needs this long to reach the map; the wave starts as it arrives. */
export const THEME_START_DELAY_MS = 150;
/** Share of the wave delay that is a deterministic ripple instead of pure west-to-east order. */
const RIPPLE_SHARE = 0.12;

export interface ThemeFx {
  /** 0 = old palette, 1 = new palette. */
  readonly mix: number;
  /** 0–1 bump while the tile changes: drives the small rise. */
  readonly lift: number;
  /** Signed lean in radians-ish units (scaled by the caller). */
  readonly tilt: number;
  /** 0–1 bump for the travelling highlight. */
  readonly glow: number;
}

function ripple(index: number): number {
  // Small deterministic hash in [0, 1): no random numbers, so the wave looks the same every time.
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Delay (ms) of each tile: its east-west position (east first, like the liquid reveal that starts at the switch), plus a gentle ripple. */
export function buildThemeWave(xs: readonly number[]): number[] {
  const west = Math.min(...xs);
  const span = Math.max(...xs) - west || 1;
  return xs.map(
    (x, index) =>
      WAVE_SPREAD_MS * ((1 - RIPPLE_SHARE) * (1 - (x - west) / span) + RIPPLE_SHARE * ripple(index)),
  );
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

export const THEME_SETTLED: ThemeFx = { mix: 1, lift: 0, tilt: 0, glow: 0 };

export function evaluateThemeWave(delay: number, elapsedMs: number, reduced: boolean): ThemeFx {
  if (reduced) {
    const t = Math.min(1, Math.max(0, elapsedMs / REDUCED_THEME_MS));
    return { mix: easeInOut(t), lift: 0, tilt: 0, glow: 0 };
  }
  const t = Math.min(1, Math.max(0, (elapsedMs - delay) / TILE_MS));
  if (t >= 1) return THEME_SETTLED;
  const bump = Math.sin(Math.PI * t);
  return { mix: easeInOut(t), lift: bump, tilt: bump, glow: bump };
}

export function themeTransitionDuration(reduced: boolean): number {
  return reduced ? REDUCED_THEME_MS : THEME_TOTAL_MS;
}
