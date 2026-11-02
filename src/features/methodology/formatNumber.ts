/** A number in Indonesian notation ("19,48"), with at most `maxDigits` decimals. */
export function formatNumber(value: number, maxDigits = 2): string {
  return value.toLocaleString('id-ID', { maximumFractionDigits: maxDigits });
}
