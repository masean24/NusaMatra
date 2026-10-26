/** 2857 basis points -> "28,57%". */
export const bpsLabel = (basisPoints: number): string =>
  `${(basisPoints / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
