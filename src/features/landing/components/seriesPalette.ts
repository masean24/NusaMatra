import { hexToRgb } from './donutArcs';

/**
 * The colours of a Lab focus's indicators, largest weight first: one line with the site, the orange
 * accent and the cobalt sea, alternating warm and cool so neighbours stay apart. Kaca uses the
 * light ends of the same hues, which hold on the cobalt glass. Shared by the ring and its legend.
 */
export const SERIES_HEX = {
  // accent, sea, peach (the accent's light end), sea-ink, sea-shallow
  normal: ['#ff8a3d', '#2f5bff', '#ffbf91', '#14268a', '#5c7fff'],
  // accent, light sea, peach, ice, sea-shallow
  glass: ['#ff8a3d', '#9db2ff', '#ffd9bf', '#e6ecff', '#5c7fff'],
} as const;

export type SeriesTheme = keyof typeof SERIES_HEX;

export const seriesRgb = (theme: SeriesTheme) => SERIES_HEX[theme].map(hexToRgb);
