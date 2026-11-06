import { localized, locale } from '@/lib/i18n';

const decimalFormatters = new Map<string, Intl.NumberFormat>();

/** Indonesian decimal formatting (0.823 → "0,82"). Formatting is display-only; values stay numeric. */
export function formatDecimal(value: number, fractionDigits = 2): string {
  let formatter = decimalFormatters.get(`${locale()}:${String(fractionDigits)}`);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale(), {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    decimalFormatters.set(`${locale()}:${String(fractionDigits)}`, formatter);
  }
  return formatter.format(value);
}

const percentFormatter = localized(() => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }));

/** 45 → "45%" (Indonesian style keeps the percent sign attached). */
export function formatPercent(percent: number): string {
  return `${percentFormatter().format(percent)}%`;
}
