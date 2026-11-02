import { describe, expect, it } from 'vitest';
import { needEndOf, needScore } from './needScore';

describe('needScore', () => {
  it('scales a "higher is worse" value between the national lowest and highest', () => {
    // Live Data Hub, poverty (P0) 2025, Kabupaten Cianjur: raw 9.82, range 1.9–42.56, norm 19.48.
    expect(needScore({ value: 9.82, min: 1.9, max: 42.56, polarity: 'negative' })).toBeCloseTo(19.48, 2);
  });

  it('flips a "higher is better" value, so the lowest value is the greatest need', () => {
    // Live Data Hub, HDI 2025, Kabupaten Cianjur: raw 69.84, range 40.35–89.55, norm 40.06.
    expect(needScore({ value: 69.84, min: 40.35, max: 89.55, polarity: 'positive' })).toBeCloseTo(40.06, 2);
    expect(needScore({ value: 40.35, min: 40.35, max: 89.55, polarity: 'positive' })).toBe(100);
    expect(needScore({ value: 89.55, min: 40.35, max: 89.55, polarity: 'positive' })).toBe(0);
  });

  it('gives no score without a direction or without a range, instead of guessing', () => {
    expect(needScore({ value: 5, min: 1, max: 9, polarity: 'contextual' })).toBeNull();
    expect(needScore({ value: 5, min: 5, max: 5, polarity: 'negative' })).toBeNull();
    expect(needScore({ value: Number.NaN, min: 1, max: 9, polarity: 'negative' })).toBeNull();
  });

  it('clips a value outside the range to 0–100', () => {
    expect(needScore({ value: 12, min: 1, max: 9, polarity: 'negative' })).toBe(100);
    expect(needScore({ value: -3, min: 1, max: 9, polarity: 'negative' })).toBe(0);
  });

  it('names which end of the raw scale is the need', () => {
    expect(needEndOf('negative')).toBe('HIGH_VALUE_IS_NEED');
    expect(needEndOf('positive')).toBe('LOW_VALUE_IS_NEED');
    expect(needEndOf('unknown')).toBeNull();
  });
});
