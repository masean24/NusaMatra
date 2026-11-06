import { locale } from '@/lib/i18n';
/** 2857 basis points -> "28,57%". */
export const bpsLabel = (basisPoints: number): string =>
  `${(basisPoints / 100).toLocaleString(locale(), { maximumFractionDigits: 2 })}%`;
