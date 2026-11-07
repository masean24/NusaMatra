/**
 * Exact threshold checks on the decimals the Data Hub sends.
 *
 * In binary floating point 70.1 − 70 is 0.09999999999999432 and 10.29 / 9.8 is 1.0499999999999998,
 * so `gap < 0.1` or `ratio < 1.05` puts some pairs that sit exactly on a threshold below it and
 * others not. Rounding the gap first would move legitimate values onto the threshold instead. Here
 * each number is read as the decimal JavaScript prints for it (the shortest one that round-trips,
 * so 70.1 is 70.1 and 0.099 is 0.099), and the comparison runs on integers, without tolerance.
 */

interface Decimal {
  /** The digits as one integer, sign included. */
  readonly digits: bigint;
  /** Power of ten the digits are scaled by: value = digits × 10^exponent. */
  readonly exponent: number;
}

const NUMBER_TEXT = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;

function toDecimal(value: number): Decimal {
  const match = Number.isFinite(value) ? NUMBER_TEXT.exec(String(value)) : null;
  if (!match) throw new RangeError(`Not a finite number: ${String(value)}`);
  const [, sign = '', whole = '0', fraction = '', exponent = '0'] = match;
  return { digits: BigInt(sign + whole + fraction), exponent: Number(exponent) - fraction.length };
}

/** The values as integers on one common scale, so they compare exactly. */
function onCommonScale(values: readonly Decimal[]): bigint[] {
  const smallest = Math.min(...values.map((value) => value.exponent));
  return values.map((value) => value.digits * 10n ** BigInt(value.exponent - smallest));
}

const magnitude = (value: bigint) => (value < 0n ? -value : value);

/** |a − b| < limit, exactly. */
export function gapIsBelow(a: number, b: number, limit: number): boolean {
  const [x = 0n, y = 0n, bound = 0n] = onCommonScale([toDecimal(a), toDecimal(b), toDecimal(limit)]);
  return magnitude(x - y) < bound;
}

/** larger / smaller < limit, exactly; `smaller` must be above 0. */
export function ratioIsBelow(larger: number, smaller: number, limit: number): boolean {
  const [big = 0n, small = 0n] = onCommonScale([toDecimal(larger), toDecimal(smaller)]);
  const bound = toDecimal(limit);
  // big / small < digits × 10^exponent  ⇔  big × 10^−exponent < small × digits (both sides scaled up).
  const left = bound.exponent < 0 ? big * 10n ** BigInt(-bound.exponent) : big;
  const right = small * bound.digits * (bound.exponent > 0 ? 10n ** BigInt(bound.exponent) : 1n);
  return left < right;
}
