export {
  STALE_AFTER_MINUTES,
  assessEarthquakeFeed,
  epicentreSymbolSize,
  magnitudeBand,
} from './earthquakeFeed';
export { depthClassOf, parseFeltReports, statesTsunamiThreat } from './earthquakeReading';
export type { DepthClass, FeltReport } from './earthquakeReading';
export type {
  EarthquakeOriginInput,
  FeedAssessment,
  FeedAssessmentInput,
  FeedDisplay,
  MagnitudeBand,
} from './earthquakeFeed';
