import { formatDecimal, formatPercent } from './format';

describe('format', () => {
  it('uses the Indonesian decimal comma', () => {
    expect(formatDecimal(0.823)).toBe('0,82');
    expect(formatDecimal(0.609)).toBe('0,61');
  });

  it('formats whole percentages without decimals', () => {
    expect(formatPercent(45)).toBe('45%');
  });
});
