import { gapIsBelow, ratioIsBelow } from './exactDecimal';

describe('gapIsBelow', () => {
  it('is strict: a gap exactly at the limit is not below it, though 70.1 − 70 is 0.0999… in binary', () => {
    expect(gapIsBelow(70, 70.1, 0.1)).toBe(false);
    expect(gapIsBelow(70.1, 70, 0.1)).toBe(false);
    expect(gapIsBelow(70, 70.099, 0.1)).toBe(true);
    expect(gapIsBelow(70, 70.101, 0.1)).toBe(false);
  });

  it('keeps legitimate values next to the limit where they are', () => {
    expect(gapIsBelow(0, 0.0999999999, 0.1)).toBe(true);
    expect(gapIsBelow(0, 0.1000000001, 0.1)).toBe(false);
  });

  it('reads numbers JavaScript prints in exponent notation, and negative values', () => {
    expect(gapIsBelow(1e-7, 0, 0.1)).toBe(true);
    expect(gapIsBelow(1e21, 1e21 + 1e6, 0.1)).toBe(false);
    expect(gapIsBelow(-0.05, 0.04, 0.1)).toBe(true);
    expect(gapIsBelow(-0.05, 0.05, 0.1)).toBe(false);
  });

  it('refuses a value that is not a finite number instead of guessing', () => {
    expect(() => gapIsBelow(Number.NaN, 1, 0.1)).toThrow(RangeError);
    expect(() => gapIsBelow(Number.POSITIVE_INFINITY, 1, 0.1)).toThrow(RangeError);
  });
});

describe('ratioIsBelow', () => {
  it('is strict: exactly 5% is not below 1.05, though 10.29 / 9.8 is 1.0499… in binary', () => {
    expect(ratioIsBelow(10.29, 9.8, 1.05)).toBe(false);
    expect(ratioIsBelow(21, 20, 1.05)).toBe(false);
    expect(ratioIsBelow(10.289, 9.8, 1.05)).toBe(true);
    expect(ratioIsBelow(10.291, 9.8, 1.05)).toBe(false);
  });

  it('works across very different magnitudes', () => {
    expect(ratioIsBelow(1.04e21, 1e21, 1.05)).toBe(true);
    expect(ratioIsBelow(1.05e-7, 1e-7, 1.05)).toBe(false);
  });
});
