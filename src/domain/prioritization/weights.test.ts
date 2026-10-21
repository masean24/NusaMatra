import { TOTAL_BASIS_POINTS, redistributeWeights, validateWeights } from './weights';

const total = (weights: Record<string, number>) =>
  Object.values(weights).reduce((sum, value) => sum + value, 0);

describe('redistributeWeights', () => {
  const start = { a: 3500, b: 2500, c: 2000, d: 2000 };

  it('keeps the total at exactly 10 000 basis points and every weight an integer', () => {
    for (const requested of [0, 1, 333, 2500, 7777, 9999, 10_000]) {
      const next = redistributeWeights(start, 'b', requested);
      expect(total(next)).toBe(TOTAL_BASIS_POINTS);
      expect(Object.values(next).every(Number.isInteger)).toBe(true);
      expect(validateWeights(next)).toEqual({ valid: true });
    }
  });

  it('gives the changed criterion the requested weight and shares the rest proportionally', () => {
    // The others were 3500 : 2000 : 2000 and now share 5000: 2333.33 / 1333.33 / 1333.33, so the one spare point goes to the first.
    expect(redistributeWeights(start, 'b', 5000)).toEqual({ a: 2334, b: 5000, c: 1333, d: 1333 });
  });

  it('breaks rounding ties towards the criterion listed first', () => {
    expect(redistributeWeights({ a: 5000, b: 5000, c: 0 }, 'c', 1)).toEqual({ a: 5000, b: 4999, c: 1 });
    expect(redistributeWeights({ a: 5000, b: 5000, c: 0 }, 'c', 1)).toEqual(
      redistributeWeights({ a: 5000, b: 5000, c: 0 }, 'c', 1),
    );
  });

  it('shares the remainder equally when every other weight is zero', () => {
    expect(redistributeWeights({ a: 10_000, b: 0, c: 0 }, 'a', 4000)).toEqual({ a: 4000, b: 3000, c: 3000 });
    expect(redistributeWeights({ a: 10_000, b: 0, c: 0, d: 0 }, 'a', 9999)).toEqual({
      a: 9999,
      b: 1,
      c: 0,
      d: 0,
    });
  });

  it('moves everything to the changed criterion at 10 000 and clamps out-of-range requests', () => {
    expect(redistributeWeights(start, 'a', 10_000)).toEqual({ a: 10_000, b: 0, c: 0, d: 0 });
    expect(redistributeWeights(start, 'a', 123_456).a).toBe(10_000);
    expect(redistributeWeights(start, 'a', -50).a).toBe(0);
    expect(total(redistributeWeights(start, 'a', -50))).toBe(TOTAL_BASIS_POINTS);
  });

  it('rounds a fractional request and keeps a lone criterion at the full total', () => {
    expect(redistributeWeights(start, 'a', 1234.6).a).toBe(1235);
    expect(redistributeWeights({ only: 10_000 }, 'only', 2500)).toEqual({ only: 10_000 });
  });

  it('preserves the criteria order of the input', () => {
    expect(Object.keys(redistributeWeights(start, 'c', 100))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not mutate its input', () => {
    const frozen = Object.freeze({ ...start });
    redistributeWeights(frozen, 'a', 100);
    expect(frozen).toEqual(start);
  });
});
