import { HILL_PATHS, STARS, WORDMARK } from './footerArt';

// The same domes as scripts/footer/build-footer-art.py, from the farthest layer to the nearest.
const HILLS: readonly (readonly [number, readonly (readonly [number, number, number])[]])[] = [
  [
    200,
    [
      [-120, 43.3, 133],
      [232, 53.3, 180],
      [531, 67.5, 187],
      [843, 67.8, 136],
      [1105, 66.3, 196],
      [1453, 59.4, 114],
    ],
  ],
  [
    246,
    [
      [-120, 37.0, 122],
      [141, 69.7, 154],
      [501, 65.8, 198],
      [750, 49.6, 133],
      [1111, 36.5, 159],
      [1439, 51.4, 197],
    ],
  ],
  [
    292,
    [
      [-120, 56.8, 176],
      [259, 44.1, 177],
      [512, 64.8, 139],
      [863, 42.1, 186],
      [1220, 54.8, 155],
      [1454, 41.4, 123],
    ],
  ],
  [
    336,
    [
      [-120, 53.6, 130],
      [153, 67.0, 186],
      [492, 41.3, 145],
      [790, 59.7, 192],
      [1026, 62.2, 167],
      [1340, 45.5, 179],
      [1586, 71.7, 165],
    ],
  ],
  [
    380,
    [
      [-120, 43.7, 118],
      [249, 31.6, 170],
      [489, 32.5, 197],
      [849, 39.2, 163],
      [1124, 46.7, 135],
      [1475, 57.4, 197],
    ],
  ],
];

function points(path: string): [number, number][] {
  return [...path.matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

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

describe('footer backdrop shapes', () => {
  it('draws each hill as base minus its Gaussian domes, every 8 units from -20 to 1460, closed below', () => {
    expect(HILL_PATHS).toHaveLength(5);
    HILLS.forEach(([base, domes], layer) => {
      const path = HILL_PATHS[layer] ?? '';
      expect(path.startsWith('M-20 420 ')).toBe(true);
      expect(path.endsWith(' L1460 420 Z')).toBe(true);
      const sampled = points(path).slice(0, -1); // the last L is the bottom-right corner
      expect(sampled).toHaveLength(186);
      sampled.forEach(([x, y], index) => {
        expect(x).toBe(-20 + index * 8);
        const expected =
          base - domes.reduce((sum, [c, h, s]) => sum + h * Math.exp(-(((x - c) / s) ** 2)), 0);
        expect(Math.abs(y - expected)).toBeLessThanOrEqual(0.05 + 1e-9);
      });
    });
  });

  it('places the 70 Kaca stars from mulberry32 seed 7, so they never move', () => {
    const random = mulberry32(7);
    expect(STARS).toHaveLength(70);
    for (const [x, y, r, opacity] of STARS) {
      expect(x).toBeCloseTo(random() * 1440, 1);
      expect(y).toBeCloseTo(random() * 170, 1);
      expect(r).toBe([0.8, 1, 1.3][Math.min(2, Math.floor(random() * 3))]);
      expect(opacity).toBeCloseTo(0.25 + random() * 0.45, 2);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1440);
      expect(y).toBeLessThanOrEqual(170);
    }
  });

  it('keeps the traced wordmark at the official PNG size: nine letters plus four counters', () => {
    expect([WORDMARK.width, WORDMARK.height]).toEqual([1123, 126]);
    expect(WORDMARK.path.match(/M/g)).toHaveLength(13);
  });
});
