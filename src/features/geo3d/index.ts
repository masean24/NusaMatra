export { HeroDioramaSlot } from './HeroDioramaSlot';
export { Explore3DMapSlot } from './Explore3DMapSlot';
export { MapLoader } from './MapLoader';
export type {
  Explore3DMapProps,
  GeoCameraHandle,
  GeoDataMode,
  GeoDisplayMode,
  GeoOverlayPoint,
  GeoRegionSelection,
  HeroDioramaProps,
  HeroHexMapProps,
} from './contract';
export type { HeroMapOutcome } from './HeroDioramaSlot';

/** Starts downloading the Jelajahi map engine (three.js and the 3D map) before it is needed. */
export const preloadExploreEngine = () => import('./engineAdapters');
