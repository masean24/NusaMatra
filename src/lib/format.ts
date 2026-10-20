const LOCALE = 'id-ID';

const decimalFormatters = new Map<number, Intl.NumberFormat>();

/** Indonesian decimal formatting (0.823 → "0,82"). Formatting is display-only; values stay numeric. */
export function formatDecimal(value: number, fractionDigits = 2): string {
  let formatter = decimalFormatters.get(fractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    decimalFormatters.set(fractionDigits, formatter);
  }
  return formatter.format(value);
}

const percentFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** 45 → "45%" (Indonesian style keeps the percent sign attached). */
export function formatPercent(percent: number): string {
  return `${percentFormatter.format(percent)}%`;
}
