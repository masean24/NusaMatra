import { buildDisplacementField, displacementScale } from './displacementMap';

const spec = { width: 120, height: 48, radius: 24, bezel: 12 } as const;

function offsetAt(pixels: Uint8ClampedArray, x: number, y: number): { red: number; green: number } {
  const index = (y * spec.width + x) * 4;
  return { red: (pixels[index] ?? 0) - 128, green: (pixels[index + 1] ?? 0) - 128 };
}

describe('buildDisplacementField', () => {
  const pixels = buildDisplacementField(spec);

  it('leaves the middle of the glass untouched', () => {
    expect(offsetAt(pixels, 60, 24)).toEqual({ red: 0, green: 0 });
    expect(offsetAt(pixels, 40, 24)).toEqual({ red: 0, green: 0 });
  });

  it('pushes each edge outward along its normal, strongest at the edge', () => {
    expect(offsetAt(pixels, 60, 0).green).toBeLessThan(-100);
    expect(offsetAt(pixels, 60, 47).green).toBeGreaterThan(100);
    expect(offsetAt(pixels, 0, 24).red).toBeLessThan(-100);
    expect(offsetAt(pixels, 119, 24).red).toBeGreaterThan(100);
    // Falls off smoothly towards the clear centre.
    const strengths = [0, 3, 6, 9].map((depth) => Math.abs(offsetAt(pixels, 60, depth).green));
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
  });

  it('follows the rounded corner instead of a rectangle', () => {
    // On the 45° part of the corner both components point diagonally outward and are equal.
    const { red, green } = offsetAt(pixels, 7, 7);
    expect(red).toBeLessThan(0);
    expect(green).toBeLessThan(0);
    expect(Math.abs(red - green)).toBeLessThanOrEqual(2);
    // The square corner outside the arc is not part of the lens: no displacement.
    expect(offsetAt(pixels, 0, 0)).toEqual({ red: 0, green: 0 });
  });

  it('is mirror-symmetric', () => {
    expect(offsetAt(pixels, 10, 3).red).toBe(-offsetAt(pixels, 109, 3).red + 0);
    expect(offsetAt(pixels, 10, 3).green).toBe(offsetAt(pixels, 109, 3).green);
  });
});

describe('displacementScale', () => {
  it('maps a full-intensity channel to the requested pixel offset', () => {
    expect(displacementScale(10) * (254 / 255) * 0.5).toBeCloseTo(10, 5);
  });
});
