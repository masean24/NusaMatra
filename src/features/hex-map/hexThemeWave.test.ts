import {
  REDUCED_THEME_MS,
  THEME_SETTLED,
  THEME_TOTAL_MS,
  TILE_MS,
  WAVE_SPREAD_MS,
  buildThemeWave,
  evaluateThemeWave,
  themeTransitionDuration,
} from './hexThemeWave';

const xs = Array.from({ length: 300 }, (_, index) => index * 0.25);

describe('buildThemeWave', () => {
  it('is deterministic and finishes inside the total duration', () => {
    const wave = buildThemeWave(xs);
    expect(wave).toEqual(buildThemeWave(xs));
    expect(Math.max(...wave)).toBeLessThanOrEqual(WAVE_SPREAD_MS);
    expect(Math.max(...wave) + TILE_MS).toBeLessThanOrEqual(THEME_TOTAL_MS);
    expect(Math.min(...wave)).toBeGreaterThanOrEqual(0);
  });

  it('travels east to west on average, following the liquid reveal that starts at the switch', () => {
    const wave = buildThemeWave(xs);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(wave.slice(225))).toBeLessThan(mean(wave.slice(0, 75)));
  });
});

describe('evaluateThemeWave', () => {
  it('leaves a tile on its old palette before the wave reaches it', () => {
    expect(evaluateThemeWave(400, 100, false)).toMatchObject({ mix: 0, lift: 0, glow: 0 });
  });

  it('rises and glows mid-change, never hides, and lands exactly on the new palette', () => {
    const mid = evaluateThemeWave(0, TILE_MS / 2, false);
    expect(mid.lift).toBeGreaterThan(0.9);
    expect(mid.glow).toBeGreaterThan(0.9);
    expect(mid.mix).toBeGreaterThan(0.4);
    expect(mid.mix).toBeLessThan(0.6);
    expect(evaluateThemeWave(0, TILE_MS, false)).toEqual(THEME_SETTLED);
    expect(evaluateThemeWave(0, TILE_MS + 5000, false)).toEqual(THEME_SETTLED);
  });

  it('keeps the mix monotonic, so the colour never moves backwards', () => {
    let previous = -1;
    for (let step = 0; step <= 40; step += 1) {
      const { mix } = evaluateThemeWave(0, (step / 40) * TILE_MS, false);
      expect(mix).toBeGreaterThanOrEqual(previous);
      previous = mix;
    }
  });

  it('with reduced motion only cross-fades: no lift, lean or highlight, all tiles together', () => {
    const half = evaluateThemeWave(650, REDUCED_THEME_MS / 2, true);
    expect(half.lift).toBe(0);
    expect(half.tilt).toBe(0);
    expect(half.glow).toBe(0);
    expect(half.mix).toBeGreaterThan(0.3);
    expect(evaluateThemeWave(650, REDUCED_THEME_MS, true).mix).toBe(1);
    expect(themeTransitionDuration(true)).toBe(REDUCED_THEME_MS);
    expect(themeTransitionDuration(false)).toBe(THEME_TOTAL_MS);
  });
});
