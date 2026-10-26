import { lazy } from 'react';

/**
 * Public entry of the hexagon map. This file stays light: the 3D scene (react-three-fiber, three.js)
 * is a lazy chunk, while the poster that stands in for it is plain SVG and loads with the page.
 */
export const HexIndonesiaMap = lazy(() =>
  import('./HexIndonesiaMap').then((module) => ({ default: module.HexIndonesiaMap })),
);
export { HexPoster } from './HexPoster';
export type { HexTheme } from './hexColors';
